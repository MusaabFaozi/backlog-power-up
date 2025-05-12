// webhook/trelloWebhook.js

const {
    VERBOSE,
    DEBUG,
    BACKLOG_LIST_NAME,
    WIP_LISTS,
    DONE_LISTS,
} = require('../config');

const { 
    handle_checklist_item_creation,
    handle_source_card_name_change,
    handle_source_card_list_change,
    handle_complete_checklist_card,
    handle_checklist_item_update,
 } = require('./utils');


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

        console.log("Received action:", action.type);

        // Perform your desired actions here
        switch (action.type) {
            case "createCard":
                // Handle adding a new card
                if (VERBOSE) {
                    console.log("Card created:", action.data.card.name, "with ID:", action.data.card.id);
                }
                break;

            case "updateCard":
                // Handle updating an existing card
                if (action.data.old && action.data.old.name) {

                    if (VERBOSE) {
                        console.log("Card name changed from:", action.data.old.name, "==>", action.data.card.name);
                    }

                    // Handle card name change
                    await handle_source_card_name_change(action.data);

                    if (VERBOSE) {
                        console.log("Card name change handled successfully!");
                    }
                    
                } else if (action.data.listBefore && action.data.listAfter) {

                    // Check which handlers to call based on the list names
                    default_lists = [BACKLOG_LIST_NAME, ...WIP_LISTS, ...DONE_LISTS];
                    incomplete_lists = [BACKLOG_LIST_NAME, ...WIP_LISTS];
                    if (!default_lists.includes(action.data.listBefore.name.toLowerCase())
                            && !default_lists.includes(action.data.listAfter.name.toLowerCase())) {
                        console.log("Source card", action.data.card.name,"moved to a list:", action.data.listAfter.name);

                        await handle_source_card_list_change(action.data);
                        if (VERBOSE) {
                            console.log("Source card list change handled successfully!");
                        }

                    } else if (incomplete_lists.includes(action.data.listBefore.name.toLowerCase())
                            && DONE_LISTS.includes(action.data.listAfter.name.toLowerCase())) {
                        console.log("Backlog card", action.data.card.name,"moved to Done list:", action.data.listAfter.name);

                        await handle_complete_checklist_card(action.data, 'complete');
                        if (VERBOSE) {
                            console.log("Card done handled successfully!");
                        }

                    } else if (DONE_LISTS.includes(action.data.listBefore.name.toLowerCase())
                            && incomplete_lists.includes(action.data.listAfter.name.toLowerCase())) {
                        console.log("Done card", action.data.card.name,"moved back to Backlog list:", action.data.listAfter.name);

                        await handle_complete_checklist_card(action.data, 'incomplete');
                        if (VERBOSE) {
                            console.log("Card undone handled successfully!");
                        }

                    } else {
                        console.log("Unhandled card move from list:", action.data.listBefore.name, "==> list:", action.data.listAfter.name);
                    }
                } else {
                    console.log("Card updated:", action.data.card);
                    if (DEBUG) {
                        console.log("action.data old:", action.data.old);
                    }
                }
                break;

            case "deleteCard":
                // Handle deleting a card
                console.log("Card deleted:", action.data);
                break;
            
            case "createCheckItem":
                // Handle adding a new checklist item

                if (VERBOSE) {
                    console.log("createCheckItem: Checklist item created:", action.data.checkItem);
                }

                // Call the handler function
                await handle_checklist_item_creation(action.data);

                if (VERBOSE) {
                    console.log("createCheckItem: Checklist item creation handled successfully!");
                }

                break;
            
            case "updateCheckItem":
                // Handle updating an existing checklist item
                console.log("Checklist item updated:", action.data.checkItem);

                // Call the handler function
                await handle_checklist_item_update(action.data);
                if (VERBOSE) {
                    console.log("Checklist item update handled successfully!");
                }
                
                break;

            case "updateCheckItemStateOnCard":
                // Handle updating the state of a checklist item on a card
                console.log("Checklist item state updated:", action.data);
                break;
            
            case "deleteCheckItem":
                // Handle deleting a checklist item
                console.log("Checklist item deleted:", action.data);
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