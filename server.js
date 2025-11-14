const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware (allow requests from your app)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// M-Pesa callback endpoint
app.post('/mpesa-callback', async (req, res) => {
    console.log('💰 M-Pesa Payment Received:', JSON.stringify(req.body, null, 2));
    
    const callbackData = req.body;
    
    try {
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
            
            // Update Supabase subscription
            const updateSuccess = await updateSupabaseSubscription(phoneNumber);
            
            if (updateSuccess) {
                console.log('✅ Supabase subscription updated successfully!');
            } else {
                console.log('❌ Failed to update Supabase');
            }
            
        } else {
            console.log('❌ Payment Failed:', callbackData.Body.stkCallback.ResultDesc);
        }
        
        // Always acknowledge receipt
        res.json({
            ResultCode: 0,
            ResultDesc: "Success"
        });
        
    } catch (error) {
        console.error('❌ Error processing callback:', error);
        res.json({
            ResultCode: 0,
            ResultDesc: "Success" // Still acknowledge to M-Pesa
        });
    }
});

// Function to update Supabase
async function updateSupabaseSubscription(phoneNumber) {
    try {
        // Your Supabase credentials
        const supabaseUrl = 'https://hqwcqngpoecyahnudpse.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd2Nxbmdwb2VjeWFobnVkcHNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3OTA0MzIsImV4cCI6MjA3ODM2NjQzMn0.A2aH6kANWuMvXQb6uD0yMB-W9EG1C89NU3VTp4BVMhI';
        
        // Calculate expiry date (30 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        const formattedDate = expiryDate.toISOString().split('.')[0];
        
        // Update Supabase
        const response = await fetch(`${supabaseUrl}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                phone_number: phoneNumber,
                subscription_status: 'active',
                subscription_expiry: formattedDate,
                current_device_id: 'from_backend',
                max_devices: 1
            })
        });
        
        if (response.ok) {
            console.log('✅ Supabase updated successfully for:', phoneNumber);
            return true;
        } else {
            console.log('❌ Supabase update failed:', await response.text());
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error updating Supabase:', error);
        return false;
    }
}

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        message: 'M-Pesa Backend is working!',
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', time: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 M-Pesa Backend running on port ${PORT}`);
    console.log(`✅ Test URL: https://tailor-mpesa-backend.onrender.com/test`);
});
