require('dotenv').config();

const apiKey = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_BACKLOG_TOKEN;

// Settings config
const BACKLOG_LIST_NAME = "backlog";
const WIP_LISTS = ["today's tasks"];
const DONE_LISTS = ["done today!"];
const META_DATA_REGEX = /\n\n\n<!--\s*Meta Data:\s*({.*?})\s*-->/;
const VERBOSE = process.env.VERBOSE === 'true' || process.env.VERBOSE === '1' || process.env.VERBOSE === 'yes';
const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1' || process.env.DEBUG === 'yes';

module.exports = {
    apiKey,
    token,
    BACKLOG_LIST_NAME,
    WIP_LISTS,
    DONE_LISTS,
    META_DATA_REGEX,
    VERBOSE,
    DEBUG,
};