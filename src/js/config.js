require('dotenv').config();

const apiKey = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_BACKLOG_TOKEN;

// Settings config
const BACKLOG_LIST_NAME = "backlog";
const WIP_LISTS = ["today's tasks"];
const DONE_LISTS = ["done today!"];
const HIDDEN_DATA_REGEX = /\n\n\n<!--\s*Hidden Data:\s*({.*?})\s*-->/;
const VERBOSE = true;
const DEBUG = true;

module.exports = {
    apiKey,
    token,
    BACKLOG_LIST_NAME,
    WIP_LISTS,
    DONE_LISTS,
    HIDDEN_DATA_REGEX,
    VERBOSE,
    DEBUG,
};