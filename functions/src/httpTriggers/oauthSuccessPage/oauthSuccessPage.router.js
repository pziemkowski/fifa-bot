export default (request, response) => {

  console.log('Request Headers' + JSON.stringify(request.headers));
  console.log('Request Body' + JSON.stringify(request.body));

  response.send('Hello!');
};
