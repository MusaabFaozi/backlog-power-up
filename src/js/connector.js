
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