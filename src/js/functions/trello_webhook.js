// webhook/trelloWebhook.js

const {
    apiKey,
    token,
    VERBOSE,
    DEBUG,
} = require('../config');


exports.handler = async (event, context) => {

    // Log the HTTP method for debugging
    console.log("HTTP Method Received:", event.httpMethod);

    // Normalize the HTTP method to avoid case sensitivity issues
    const httpMethod = event.httpMethod ? event.httpMethod.toUpperCase() : "";

    // Check if the request is a HEAD request (Trello does this for validation)
    if (httpMethod == "HEAD" || httpMethod == "GET") {
        return {
            statusCode: 200,
            body: "",
        };
    }

    // Handle other HTTP methods (e.g., POST)
    if (httpMethod == "POST") {
        // Process the incoming Trello webhook payload
        const payload = JSON.parse(event.body);
        const action = payload.action;

        // Perform your desired actions here
        switch (action.type) {
            case "createCard":
                // Handle adding a new card
                console.log("Card created:", action.data.card);
                break;

            case "updateCard":
                // Handle updating an existing card
                if (action.data.old && action.data.old.name) {
                    console.log("Card name changed from:", action.data.old.name, "to:", action.data.card.name);
                } else if (action.data.listBefore && action.data.listAfter) {
                    console.log("Card moved from list:", action.data.listBefore.name, "to list:", action.data.listAfter.name);
                } else {
                    console.log("Card updated:", action.data.card);
                }
                break;

            case "deleteCard":
                // Handle deleting a card
                console.log("Card deleted:", action.data.card);
                break;
            
            case "createCheckItem":
                // Handle adding a new checklist item
                console.log("Checklist item created:", action.data.checkItem);
                break;
            
            case "updateCheckItem":
                // Handle updating an existing checklist item
                console.log("Checklist item updated:", action.data.checkItem);
                break;
            
            case "deleteCheckItem":
                // Handle deleting a checklist item
                console.log("Checklist item deleted:", action.data.checkItem);
                break;
            
            default:
                console.log("Unhandled action type:", action.type);
                break;
        }

        return {
            statusCode: 200,
            body: "Webhook received",
        };
    }

    // If the request is not HEAD or POST, return 405 Method Not Allowed

    var body = "Method Not Allowed\n";
    if (DEBUG) {
        body += httpMethod + '\n';
        body += "Method head comparison: " + httpMethod === "HEAD";
        body += JSON.stringify(event);
    }

    return {
        statusCode: 405,
        body: body,
    };
};