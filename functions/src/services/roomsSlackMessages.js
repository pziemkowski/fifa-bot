const functions = require('firebase-functions');
const { WebClient } = require('@slack/client');
const humps = require('humps');
const { keys, defaultTo, range, reduce, concat, always, ifElse, equals, map, pipe, join } = require('ramda');

const ROOM_SIZE = 4;
const RECREATE_MESSAGE_TIMEOUT = 10 * 60;

const slackClient = new WebClient(functions.config().slack['bot_user_access_token']);

const getMessageAttachments = (membersIds) => {
  const membersCount = membersIds.length;
  return reduce(concat, [], [
    membersIds.map((userId) => ({
      text: `<@${userId}> is ready!`,
      color: '#4CAF50',
    })),
    range(membersCount, ROOM_SIZE).map(always({
      text: `Empty seat.`,
      color: '#F44336',
    })),
  ]);
};

const getMessageText = (membersIds) => ifElse(
  equals(ROOM_SIZE),
  always(`The game has started. Those are the players:`),
  always('Who wants to play?')
)(membersIds.length);

export function dispatchNewRoomMessage(channelId, roomMembers) {
  const memberIds = keys(roomMembers);
  const attachments = getMessageAttachments(memberIds);
  const text = getMessageText(memberIds);

  return slackClient.chat.postMessage({
    channel: channelId,
    text,
    attachments,
  });
}

export async function recreateRoomMessage(channelId, roomMembers, messageTimestamp) {
  await slackClient.chat.delete({ channel: channelId, ts: messageTimestamp });
  return dispatchNewRoomMessage(channelId, roomMembers);
}

export function updateRoomMessage(channelId, roomMembers, messageTimestamp) {
  const membersIds = keys(roomMembers);
  const attachments = getMessageAttachments(membersIds);
  const text = getMessageText(membersIds);


  return slackClient.chat.update({
    channel: channelId,
    ts: messageTimestamp,
    text,
    attachments,
  });
}

export async function dispatchGameReadyThreadMessage(channelId, roomMembers, messageTimestamp) {
  await slackClient.chat.postMessage({
    channel: channelId,
    'thread_ts': messageTimestamp,
    text: pipe(
      keys,
      map((userId) => `<@${userId}>`),
      join(' ')
    )(roomMembers)
  });

  await slackClient.chat.postMessage({
    channel: channelId,
    'thread_ts': messageTimestamp,
    text: 'Game is ready! Go go go!',
  });
}

export const extractMessageMetadata = (originalDetectIntentRequest) => {
  const { source, data } = originalDetectIntentRequest.payload;
  if (source === 'slack') {
    const { teamId, event } = humps.camelizeKeys(data);
    const { channel: channelId, user: userId } = event;

    return { teamId, channelId, userId };
  }

  throw new Error(`Event source ${source} not supported.`);
};