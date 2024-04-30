console.log("Hello World!");

window.TrelloPowerUp.initialize({
    "board-buttons": function(t, options) {
        return [{
            icon: "https://cdn-icons-png.flaticon.com/512/5360/5360758.png",
            text: "Backlog Items",
            callback: function (t) {
                return t.board().then(card => alert("Hello, there!"))
            }
        }];
    }
});