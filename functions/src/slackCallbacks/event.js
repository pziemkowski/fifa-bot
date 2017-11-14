const functions = require('firebase-functions');
const admin = require('firebase-admin');
const apiai = require('apiai');
const humps = require('humps');
const co = require('co');
const moment = require('moment');
const { WebClient } = require('@slack/client');
const { OK, INTERNAL_SERVER_ERROR, } = require('http-status');
const { keys, defaultTo, pipe, head, mergeDeepRight, mergeDeepLeft, range, concat, always, has, ifElse, equals } = require('ramda');

const handleWhen = require('./handleWhen');
const { EVENT_CALLBACK } = require('./types');

const slackClient = new WebClient(functions.config().slack.bot_user_access_token);
const apiAIApp = apiai(functions.config().dialogflow.access_token);

const handleCallback = handleWhen(EVENT_CALLBACK);

const INTENT_CREATE_ROOM = 'create_room';
const INTENT_JOIN_ROOM = 'join_room';
const INTENT_LEAVE_ROOM = 'leave_room';
const EMPTY_CONTEXTS = [];

const rootRef = admin.database().ref('/');
const teamRoomsRef = rootRef.child('teamRooms');
const roomsRef = rootRef.child('rooms');
const roomMembersRef = rootRef.child('roomMembers');

const ROOM_SIZE = 4;

const getActiveRoom = co.wrap(function* (teamId, channelId) {
  const activeRoomQuery = teamRoomsRef
    .child(teamId)
    .child(channelId)
    .orderByKey()
    .limitToLast(1);
  const snapshot = yield activeRoomQuery.once('value');
  const activeRooms = snapshot.val();
  const activeRoomId = pipe(defaultTo({}), keys, head)(activeRooms);

  if (activeRoomId) {
    const snapshot = yield roomMembersRef.child(activeRoomId).once('value');

    if (snapshot.numChildren() < ROOM_SIZE) {
      return activeRoomId;
    }
  }

  return null;
});

const getRoom = co.wrap(function* (id) {
  const roomRef = roomsRef.child(id);
  const snapshot = yield roomRef.once('value');
  return snapshot.val();
});

const getRoomContexts = (room) => {
  const now = moment();
  const createdAt = moment.unix(room.createdAt);
  if (now.diff(createdAt, 'minutes') > 30 || !room.contexts) {
    return EMPTY_CONTEXTS;
  }

  try {
    return JSON.parse(room.contexts);
  } catch (error) {
    console.error(error);
    return EMPTY_CONTEXTS;
  }
};

const dispatchNewRoomMessage = co.wrap(function* ({ channelId, ownerId }) {
  return yield new Promise((resolve, reject) => {
    slackClient.chat.postMessage(channelId, 'Who would like to play a game?', {
      attachments: concat(
        [{
          text: `<@${ownerId}> is ready!`,
          color: '#4CAF50',
          attachment_type: 'default',
        }],
        range(1, ROOM_SIZE).map(always({
          text: `Empty seat.`,
          color: '#F44336',
          attachment_type: 'default',
        }))
      )
    }, function (err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  })
});

const updateRoomMessage = co.wrap(function* ({ channelId, room, roomMembers }) {
  return yield new Promise((resolve, reject) => {
    const membersIds = keys(roomMembers);
    const membersCount = membersIds.length;
    const attachments = concat(
      membersIds.map((userId) => ({
        text: `<@${userId}> is ready!`,
        color: '#4CAF50',
        attachment_type: 'default',
      })),
      range(membersCount, ROOM_SIZE).map(always({
        text: `Empty seat.`,
        color: '#F44336',
        attachment_type: 'default',
      }))
    );

    const text = ifElse(
      equals(ROOM_SIZE),
      always(`The game has started. Those are the players:`),
      always('Who wants to play? ')
    )(membersCount);

    slackClient.chat.update(room.messageTs, channelId, text, {
      attachments,
    }, function (err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    })
  });
});

const createNewRoom = co.wrap(function* ({ teamId, channelId, userId, contexts }) {
  const { key: newRoomId } = roomsRef.push();
  const createdAt = moment().unix();

  yield rootRef.update({
    [`rooms/${newRoomId}`]: {
      teamId,
      channelId,
      createdAt,
      ownerId: userId,
      contexts: JSON.stringify(contexts),
    },
    [`teamRooms/${teamId}/${channelId}/${newRoomId}`]: true,
    [`roomMembers/${newRoomId}/${userId}`]: true,
  });

  const { ts } = yield dispatchNewRoomMessage({ channelId, ownerId: userId });
  yield roomsRef.child(newRoomId).child('messageTs').set(ts);
});

const addUserToRoom = co.wrap(function* ({ roomId, room, userId, channelId }) {
  const { committed, snapshot } = yield roomMembersRef.child(roomId).transaction((currentValue) => {
    if (!currentValue) {
      return { [userId]: true };
    }

    if (keys(currentValue).length < ROOM_SIZE && !has(userId, currentValue)) {
      return mergeDeepRight({ [userId]: true }, currentValue);
    }

    return undefined;
  });

  if (committed) {
    const roomMembers = snapshot.val();
    yield updateRoomMessage({ channelId, room, roomMembers });
  }
});

const removeUserFromRoom = co.wrap(function* ({ roomId, room, userId, channelId }) {
  const { committed, snapshot } = yield roomMembersRef.child(roomId).transaction((currentValue) => {
    if (!currentValue) {
      return currentValue;
    }

    if (has(userId, currentValue)) {
      return mergeDeepLeft({ [userId]: null }, currentValue);
    }

    return undefined;
  });

  if (committed) {
    const roomMembers = snapshot.val();
    yield updateRoomMessage({ channelId, room, roomMembers });
  }
});

const handleDialogflowResponse = co.wrap(function* (response, options) {
  const { teamId, channelId, userId, activeRoom, activeRoomId } = options;
  const { result: { contexts, metadata: { intentName } } } = response;

  if (intentName === INTENT_CREATE_ROOM) {
    return yield createNewRoom({
      teamId,
      channelId,
      userId,
      contexts,
    });
  }

  if (intentName === INTENT_JOIN_ROOM) {
    return yield addUserToRoom({
      roomId: activeRoomId,
      room: activeRoom,
      userId,
      channelId,
    });
  }

  if (intentName === INTENT_LEAVE_ROOM) {
    return yield removeUserFromRoom({
      roomId: activeRoomId,
      room: activeRoom,
      userId,
      channelId,
    });
  }
});

const handleMessage = co.wrap(function* (req) {
  const { body } = req;
  const { teamId, event } = humps.camelizeKeys(body);
  const { channel: channelId, user: userId } = event;
  const activeRoomId = yield getActiveRoom(teamId, channelId);
  const activeRoom = activeRoomId ? yield getRoom(activeRoomId) : null;
  const contexts = activeRoom ? getRoomContexts(activeRoom) : EMPTY_CONTEXTS;

  const dialogflowResponse = yield new Promise((resolve, reject) => {
    const request = apiAIApp.textRequest(event.text, {
      sessionId: channelId,
      resetContexts: true,
      contexts,
    });

    request.on('response', resolve);
    request.on('error', reject);
    request.end();
  });

  console.log(dialogflowResponse);

  return yield handleDialogflowResponse(dialogflowResponse, {
    teamId,
    channelId,
    activeRoomId,
    activeRoom,
    userId,
  });
});

module.exports = handleCallback((req, res) => {
  const { body } = req;
  const { event } = body;

  if (event.type === 'message' && !event.subtype) {
    return handleMessage(req)
      .then(() => {
        res.status(OK).send('');
      })
      .catch((error) => {
        console.error(error);
        res.status(INTERNAL_SERVER_ERROR).send('');
      });
  }

  return res.status(OK).send({});
});
