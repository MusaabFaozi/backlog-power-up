require('dotenv').config();
const apiKey = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_BACKLOG_TOKEN;

// Settings config
const BACKLOG_LIST_NAME = "backlog";
const AUXILIARY_LISTS = ["done today", ]


var backlog_all = function(t) {

    return t.lists('all')
    .then(function(lists) {

        console.log("lists: ", lists);
        const backlog_list = lists.find(list => list.name.toLowerCase() === 'backlog');
        console.log("backlog list: ", backlog_list);

        if(!backlog_list) {
            return t.popup({
                title: 'Error',
                items: [
                  { text: 'Backlog list is not found on this board.', callback: function(t) { return t.closePopup(); } }
                ]
              });
        }
        
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