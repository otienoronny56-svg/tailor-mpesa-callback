const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware (allow requests from your app)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    next();
});

// M-Pesa callback endpoint
app.post('/mpesa-callback', async (req, res) => {
    console.log('💰 M-Pesa Payment Received:', JSON.stringify(req.body, null, 2));
    
    const callbackData = req.body;
    
    try {
        // Check if payment was successful
        if (callbackData.Body?.stkCallback?.ResultCode === 0) {
            console.log('✅ Payment Successful!');
            
            // Extract phone number and amount from callback metadata
            const callbackMetadata = callbackData.Body.stkCallback.CallbackMetadata;
            if (!callbackMetadata || !callbackMetadata.Item) {
                console.log('❌ No callback metadata found');
                return res.json({ ResultCode: 0, ResultDesc: "Success" });
            }
            
            const items = callbackMetadata.Item;
            let phoneNumber, amount;
            
            items.forEach(item => {
                if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
                if (item.Name === 'Amount') amount = item.Value;
            });
            
            console.log(`📞 Phone: ${phoneNumber}, 💰 Amount: ${amount}`);
            
            if (phoneNumber) {
                // Update Supabase subscription
                const updateSuccess = await updateSupabaseSubscription(phoneNumber);
                
                if (updateSuccess) {
                    console.log('✅ Supabase subscription updated successfully!');
                } else {
                    console.log('❌ Failed to update Supabase');
                }
            } else {
                console.log('❌ No phone number found in callback');
            }
            
        } else {
            const errorDesc = callbackData.Body?.stkCallback?.ResultDesc || 'Unknown error';
            console.log('❌ Payment Failed:', errorDesc);
        }
        
        // Always acknowledge receipt to M-Pesa
        res.json({
            ResultCode: 0,
            ResultDesc: "Success"
        });
        
    } catch (error) {
        console.error('❌ Error processing callback:', error);
        // Still acknowledge to M-Pesa even if we have errors
        res.json({
            ResultCode: 0,
            ResultDesc: "Success"
        });
    }
});

// Function to update Supabase - FIXED VERSION
async function updateSupabaseSubscription(phoneNumber) {
    try {
        console.log('🔄 Updating Supabase for:', phoneNumber);
        
        // Your Supabase credentials
        const supabaseUrl = 'https://hqwcqngpoecyahnudpse.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd2Nxbmdwb2VjeWFobnVkcHNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3OTA0MzIsImV4cCI6MjA3ODM2NjQzMn0.A2aH6kANWuMvXQb6uD0yMB-W9EG1C89NU3VTp4BVMhI';
        
        // Calculate expiry date (30 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        const formattedDate = expiryDate.toISOString().split('.')[0] + 'Z';
        
        console.log('📅 Setting expiry to:', formattedDate);
        
        // Generate a simple device ID for backend
        const deviceId = 'backend_' + Date.now();
        
        // Data to upsert
        const userData = {
            phone_number: phoneNumber,
            subscription_status: 'active',
            subscription_expiry: formattedDate,
            current_device_id: deviceId,
            max_devices: 1
        };
        
        console.log('📤 Sending to Supabase:', userData);
        
        // Use UPSERT to insert or update
        const response = await fetch(`${supabaseUrl}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(userData)
        });
        
        const responseText = await response.text();
        console.log('📥 Supabase response status:', response.status);
        console.log('📥 Supabase response:', responseText);
        
        if (response.ok) {
            console.log('✅ Supabase updated successfully for:', phoneNumber);
            return true;
        } else {
            console.log('❌ Supabase update failed. Status:', response.status);
            console.log('❌ Response:', responseText);
            
            // Try alternative approach - use PUT for upsert
            console.log('🔄 Trying alternative update method...');
            return await tryAlternativeUpdate(phoneNumber, formattedDate, deviceId);
        }
        
    } catch (error) {
        console.error('❌ Error updating Supabase:', error.message);
        return false;
    }
}

// Alternative update method
async function tryAlternativeUpdate(phoneNumber, expiryDate, deviceId) {
    try {
        const supabaseUrl = 'https://hqwcqngpoecyahnudpse.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd2Nxbmdwb2VjeWFobnVkcHNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3OTA0MzIsImV4cCI6MjA3ODM2NjQzMn0.A2aH6kANWuMvXQb6uD0yMB-W9EG1C89NU3VTp4BVMhI';
        
        // Try upsert with on_conflict parameter
        const userData = {
            phone_number: phoneNumber,
            subscription_status: 'active',
            subscription_expiry: expiryDate,
            current_device_id: deviceId,
            max_devices: 1
        };
        
        const response = await fetch(`${supabaseUrl}/rest/v1/users?on_conflict=phone_number`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            console.log('✅ Alternative update successful!');
            return true;
        } else {
            console.log('❌ Alternative update also failed');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error in alternative update:', error);
        return false;
    }
}

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        message: 'M-Pesa Backend is working!',
        timestamp: new Date().toISOString(),
        status: 'OK'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', time: new Date().toISOString() });
});

// Manual test endpoint to trigger Supabase update
app.get('/test-update/:phone', async (req, res) => {
    const phone = req.params.phone;
    console.log('🧪 Manual test update for:', phone);
    
    const success = await updateSupabaseSubscription(phone);
    
    res.json({
        phone: phone,
        updateSuccess: success,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 M-Pesa Backend running on port ${PORT}`);
    console.log(`✅ Test URL: https://tailor-mpesa-backend.onrender.com/test`);
    console.log(`🧪 Manual test: https://tailor-mpesa-backend.onrender.com/test-update/254708374149`);
});
