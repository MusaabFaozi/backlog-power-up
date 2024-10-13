// webhook/trelloWebhook.js

exports.handler = async (event, context) => {
    // Check if the request is a HEAD request (Trello does this for validation)
    if (event.httpMethod === "HEAD") {
        return {
            statusCode: 200,
            body: "",
        };
    }

    // Handle other HTTP methods (e.g., POST)
    if (event.httpMethod === "POST") {
        // Process the incoming Trello webhook payload
        const payload = JSON.parse(event.body);

        // Perform your desired actions here

        return {
            statusCode: 200,
            body: "Webhook received",
        };
    }

    // If the request is not HEAD or POST, return 405 Method Not Allowed
    return {
        statusCode: 405,
        body: "Method Not Allowed",
    };
};