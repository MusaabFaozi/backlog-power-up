// webhook/trelloWebhook.js

const {
    VERBOSE,
    DEBUG,
    BACKLOG_LIST_NAME,
    WIP_LISTS,
    DONE_LISTS,
} = require('../config');

const { 
    get_lists_by_names,
    get_cards_in_lists,
    get_incomplete_checklist_items,
    get_custom_fields,
    update_card_name
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

        // Perform your desired actions here
        switch (action.type) {
            case "createCard":
                // Handle adding a new card
                console.log("Card created:", action.data.card);
                break;

            case "updateCard":
                // Handle updating an existing card
                if (action.data.old && action.data.old.name) {
                    console.log("Card name changed from:", action.data.old.name, "==>", action.data.card.name);
                    
                    // Get board ID and default list names
                    const board_id = action.data.card.idBoard;
                    const defaultlist_names = [BACKLOG_LIST_NAME, ...WIP_LISTS, ...DONE_LISTS];

                    // Get incomplete checklist items and default list IDs
                    const defaultlists_ids = get_lists_by_names(board_id, defaultlist_names).map(list => list.id);
                    
                    // Get cards in default lists
                    const checklist_cards = await get_cards_in_lists(worklists_ids);

                    // Check if the card is not in a default list
                    if (!defaultlists_ids.includes(action.data.card.idList)) {
                        for (const checklist_card of checklist_cards) {
                            if (checklist_card.name.includes(action.data.old.name)) {

                                // Retrieve custom fields for the card
                                const custom_fields = await get_custom_fields(board_id, checklist_card.id);
                                
                                // Check if Task ID equals the card ID
                                if (custom_fields && custom_fields.length > 0) {
                                    const task_id = custom_fields.find(field => field.name === "Task ID");
                                    if (task_id && task_id.value === action.data.card.id) {
                                        // Update the card name based on "Task Name"
                                        const task_name_field = custom_fields.find(field => field.name === "Task Name");
                                        const project_name_field = custom_fields.find(field => field.name === "Project Name");

                                        if (task_name_field && task_name_field.value 
                                            && project_name_field && project_name_field.value) {

                                            new_name = `[${project_name_field.value}] task_name_field.value`;
                                            const update_result = await update_card_name(checklist_card.id, new_name);
                                            if (update_result) {
                                                console.log("Card name successfully updated:", new_name);
                                            } else {
                                                console.log("Failed to update card name:", new_name);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else if (action.data.listBefore && action.data.listAfter) {
                    console.log("Card moved from list:", action.data.listBefore.name, "==> list:", action.data.listAfter.name);
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