console.log("Hello World!");

window.TrelloPowerUp.initialize({
    "card-buttons": function(t, options) {
        return [{
            icon: "https://cdn-icons-png.flaticon.com/512/5360/5360758.png",
            text: "Hello, World!",
            callback: function (t) {
                return t.card().then(card => alert("Hello, there!"))
            }
        }];
    }
});