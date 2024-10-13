// webhook/trelloWebhook.js

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed',
        };
    }

    try {
        const data = JSON.parse(event.body);
        console.log('Webhook received:', data);

        // Handle the webhook payload
        // For example, you can check action type, card details, etc.
        // const { action } = data;

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Webhook processed successfully' }),
        };
    } catch (error) {
        console.error('Error processing webhook:', error);
        return {
            statusCode: 500,
            body: 'Internal Server Error',
        };
    }
};