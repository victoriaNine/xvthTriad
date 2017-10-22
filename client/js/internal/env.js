import UAParser from 'ua-parser-js';

const uaParser = new UAParser();
const env = uaParser.getResult();

export default env;
