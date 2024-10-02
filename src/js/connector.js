require('dotenv').config();
const apiKey = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_BACKLOG_TOKEN;


var backlog_all = function(t) {

    console.log(t.lists());

    return t.board("id", "name")
    .then(function(board) {

        const boardid = board.id;
        const boardname = board.name;
        console.log("board id: ", boardid);
        console.log("board name: ", boardname);

    })
}

window.TrelloPowerUp.initialize({
    "board-buttons": function(t, options) {
        return [{
            icon: "https://cdn-icons-png.flaticon.com/512/5360/5360758.png",
            text: "Backlog All!",
            callback: function (t) {
                return backlog_all(t)
            }
        }];
    }
});