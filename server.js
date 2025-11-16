const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    next();
});

// ✅ CLEAN: Validation URL - M-Pesa asks "Should we accept this payment?"
app.post('/validate', (req, res) => {
    console.log('🔍 Validation Request:', JSON.stringify(req.body, null, 2));
    
    // Always accept payments for subscription payments
    res.json({
        "ResultCode": "0",
        "ResultDesc": "Accepted"
    });
});

// ✅ CLEAN: Confirmation URL - M-Pesa says "Payment completed!" 
app.post('/confirm', async (req, res) => {
    console.log('💰 Payment Confirmation:', JSON.stringify(req.body, null, 2));
    
    const callbackData = req.body;
    
    try {
        if (callbackData.TransID && callbackData.TransAmount) {
            console.log('✅ Payment Successful!');
            
            const phoneNumber = callbackData.MSISDN;
            const amount = callbackData.TransAmount;
            
            console.log(`📞 Phone: ${phoneNumber}, 💰 Amount: ${amount}`);
            
            if (phoneNumber) {
                const updateSuccess = await updateSupabaseSubscription(phoneNumber);
                
                if (updateSuccess) {
                    console.log('✅ Supabase subscription updated successfully!');
                } else {
                    console.log('❌ Failed to update Supabase');
                }
            }
        } else {
            console.log('❌ Payment Failed or incomplete data');
        }
        
        // Always acknowledge receipt to M-Pesa
        res.json({
            "ResultCode": "0",
            "ResultDesc": "Success"
        });
        
    } catch (error) {
        console.error('❌ Error processing confirmation:', error);
        res.json({
            "ResultCode": "0", 
            "ResultDesc": "Success"
        });
    }
});

// KEEP existing route for testing (but Safaricom won't use this)
app.post('/mpesa-callback', async (req, res) => {
    console.log('📞 Legacy callback received (for testing)');
    // ... keep your existing logic here for testing
    res.json({ ResultCode: 0, ResultDesc: "Success" });
});

// KEEP all your existing functions (updateSupabaseSubscription, etc.)
async function updateSupabaseSubscription(phoneNumber) {
    // ... keep your existing updateSupabaseSubscription function exactly as is
    try {
        console.log('🔄 Updating Supabase for:', phoneNumber);
        
        const supabaseUrl = 'https://hqwcqngpoecyahnudpse.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd2Nxbmdwb2VjeWFobnVkcHNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3OTA0MzIsImV4cCI6MjA3ODM2NjQzMn0.A2aH6kANWuMvXQb6uD0yMB-W9EG1C89NU3VTp4BVMhI';
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        const formattedDate = expiryDate.toISOString().split('.')[0] + 'Z';
        
        const deviceId = 'backend_' + Date.now();
        
        const userData = {
            phone_number: phoneNumber,
            subscription_status: 'active',
            subscription_expiry: formattedDate,
            current_device_id: deviceId,
            max_devices: 1
        };
        
        console.log('📤 Sending to Supabase:', userData);
        
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
        
        if (response.ok) {
            console.log('✅ Supabase updated successfully for:', phoneNumber);
            return true;
        } else {
            console.log('❌ Supabase update failed. Status:', response.status);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error updating Supabase:', error.message);
        return false;
    }
}

// KEEP your test endpoints
app.get('/test', (req, res) => {
    res.json({ 
        message: 'M-Pesa Backend is working!',
        timestamp: new Date().toISOString(),
        status: 'OK',
        endpoints: {
            validate: '/validate',
            confirm: '/confirm',
            test: '/test'
        }
    });
});

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
    console.log(`✅ Clean endpoints ready for Safaricom:`);
    console.log(`   📍 Validation: https://tailor-mpesa-backend.onrender.com/validate`);
    console.log(`   📍 Confirmation: https://tailor-mpesa-backend.onrender.com/confirm`);
});
