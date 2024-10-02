require('dotenv').config();
const apiKey = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_BACKLOG_TOKEN;

// Settings config
const BACKLOG_LIST_NAME = "backlog";
const AUXILIARY_LISTS = ["done today!", "today's tasks"];


var backlog_all = function(t) {

    return t.lists('all')
    .then(function(lists) {

        const backlog_list = lists.find(list => list.name.toLowerCase() === BACKLOG_LIST_NAME);

        if(!backlog_list) {
            return t.popup({
                title: 'Error',
                items: [
                  { text: 'Backlog list is not found on this board.', callback: function(t) { return t.closePopup(); } }
                ]
              });
        }

        const backlog_list_id = backlog_list.id;
        const auxiliary_list_ids = lists
            .filter(list => AUXILIARY_LISTS.includes(list.name.toLowerCase()))
            .map(list => list.id);

        // Retrieve all cards
        return t.cards('id', 'name', 'idList', 'idChecklists').then(function(cards) {
            // Filter out backlog and auxiliary cards
            console.log("cards: ", cards);
            const relevant_cards = cards.filter(card => card.idList !== backlog_list_id && !auxiliary_list_ids.includes(card.idList));
            console.log("relevant_cards: ", relevant_cards);

            const card_checklist_promises = relevant_cards.map(card => {
              return t.get(`/1/cards/${card.id}/checklists`, { key: apiKey, token: token })
                .then(function(checklists) {
                  const incomplete_items = checklists.flatMap(checklist => checklist.checkItems)
                    .filter(item => item.state === 'incomplete')
                    .map(item => ({ cardName: card.name, itemName: item.name }));
                  return incomplete_items;
                });
            });

            // Wait for all checklist data to be retrieved
            return Promise.all(card_checklist_promises).then(function(all_incomplete_items) {
                const incomplete_checklist_items = all_incomplete_items.flat(); // Flatten the array of checklist items
  
                // Create a new card in the Backlog for each incomplete checklist item
                const create_card_promises = incomplete_checklist_items.map(item => {
                  return t.post(`/1/cards`, {
                    name: `[${item.cardName}] ${item.itemName}`,
                    desc: `Originally from card: ${item.cardName}`,
                    idList: backlog_list_id,
                    pos: 'top'
                  }, { key: apiKey, token: token });
                });

                // Wait for all cards to be created
                return Promise.all(create_card_promises).then(function() {
                    return t.popup({
                        title: 'Success',
                        items: [
                        { text: `Created ${incomplete_checklist_items.length} cards in ${BACKLOG_LIST_NAME} for incomplete items.`, callback: function(t) { return t.closePopup(); }}
                        ]
                    });
                });
            });
        });
    });
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