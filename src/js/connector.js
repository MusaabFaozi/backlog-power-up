require('dotenv').config();
const apiKey = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_BACKLOG_TOKEN;

console.log("apiKey", apiKey);
console.log("token", token);

var backlog_all = function (t) {

    console.log(t.lists());

    return t.get("lists", "shared")
    .then(function(t, lists) {

        console.log(lists)

        t.popup({
            title: "All lists",
            url: "./popup.html",
        })
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