const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// M-Pesa callback endpoint
app.post('/mpesa-callback', (req, res) => {
    console.log('💰 M-Pesa Payment Received:', JSON.stringify(req.body, null, 2));
    
    const callbackData = req.body;
    
    // Check if payment was successful
    if (callbackData.Body.stkCallback.ResultCode === 0) {
        console.log('✅ Payment Successful!');
        
        // Extract phone number and amount
        const callbackMetadata = callbackData.Body.stkCallback.CallbackMetadata;
        const items = callbackMetadata.Item;
        
        let phoneNumber, amount;
        
        items.forEach(item => {
            if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
            if (item.Name === 'Amount') amount = item.Value;
        });
        
        console.log(`📞 Phone: ${phoneNumber}, 💰 Amount: ${amount}`);
        
        // Here you would:
        // 1. Update Supabase subscription
        // 2. Send confirmation
        // 3. Log the transaction
        
    } else {
        console.log('❌ Payment Failed:', callbackData.Body.stkCallback.ResultDesc);
    }
    
    // Always acknowledge receipt
    res.json({
        ResultCode: 0,
        ResultDesc: "Success"
    });
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'M-Pesa Backend is working!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 M-Pesa Backend running on port ${PORT}`);
});
