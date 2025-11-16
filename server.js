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
    console.log('🔍 Validation Request Received:', JSON.stringify(req.body, null, 2));
    
    // Extract payment details
    const transactionData = req.body;
    const phoneNumber = transactionData.MSISDN;
    const amount = transactionData.TransAmount;
    const accountNumber = transactionData.BillRefNumber;
    
    console.log(`📞 Validating payment - Phone: ${phoneNumber}, Amount: ${amount}, Account: ${accountNumber}`);
    
    // Always accept payments for subscription payments
    // In future, you can add validation logic here (check if amount is correct, etc.)
    const validationResponse = {
        "ResultCode": "0",
        "ResultDesc": "Accepted"
    };
    
    console.log('✅ Validation Response:', validationResponse);
    res.json(validationResponse);
});

// ✅ CLEAN: Confirmation URL - M-Pesa says "Payment completed!" 
app.post('/confirm', async (req, res) => {
    console.log('💰 Payment Confirmation Received:', JSON.stringify(req.body, null, 2));
    
    const transactionData = req.body;
    
    try {
        // Extract transaction details
        const transactionId = transactionData.TransID;
        const phoneNumber = transactionData.MSISDN;
        const amount = transactionData.TransAmount;
        const transactionTime = transactionData.TransTime;
        const businessShortCode = transactionData.BusinessShortCode;
        
        console.log(`🎯 Processing payment - ID: ${transactionId}, Phone: ${phoneNumber}, Amount: ${amount}`);
        
        if (transactionId && phoneNumber && amount) {
            console.log('✅ Payment Successful! Processing subscription...');
            
            // Update Supabase with new subscription
            const updateSuccess = await updateSupabaseSubscription(phoneNumber);
            
            if (updateSuccess) {
                console.log('✅ Supabase subscription updated successfully!');
            } else {
                console.log('❌ Failed to update Supabase subscription');
            }
            
            // Log successful transaction
            console.log(`📝 Transaction Complete:
            - Transaction ID: ${transactionId}
            - Phone: ${phoneNumber} 
            - Amount: KSH ${amount}
            - Time: ${transactionTime}
            - ShortCode: ${businessShortCode}
            `);
            
        } else {
            console.log('❌ Invalid payment data received');
        }
        
        // Always acknowledge receipt to M-Pesa
        const confirmationResponse = {
            "ResultCode": "0",
            "ResultDesc": "Success"
        };
        
        console.log('📤 Sending confirmation response to M-Pesa');
        res.json(confirmationResponse);
        
    } catch (error) {
        console.error('❌ Error processing payment confirmation:', error);
        
        // Still acknowledge receipt to M-Pesa even if we have errors
        res.json({
            "ResultCode": "0", 
            "ResultDesc": "Success"
        });
    }
});

// FIXED: Function to update Supabase subscription (handles duplicates)
async function updateSupabaseSubscription(phoneNumber) {
    try {
        console.log('🔄 Updating Supabase subscription for:', phoneNumber);
        
        // Your Supabase credentials
        const supabaseUrl = 'https://hqwcqngpoecyahnudpse.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxd2Nxbmdwb2VjeWFobnVkcHNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3OTA0MzIsImV4cCI6MjA3ODM2NjQzMn0.A2aH6kANWuMvXQb6uD0yMB-W9EG1C89NU3VTp4BVMhI';
        
        // Calculate expiry date (30 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        const formattedDate = expiryDate.toISOString().split('.')[0] + 'Z';
        
        // Generate device ID for backend
        const deviceId = 'backend_' + Date.now();
        
        // User data for Supabase
        const userData = {
            phone_number: phoneNumber,
            subscription_status: 'active',
            subscription_expiry: formattedDate,
            current_device_id: deviceId,
            max_devices: 1
        };
        
        console.log('📤 Sending to Supabase:', userData);
        
        // FIXED: Use PATCH to update existing user instead of POST
        // This updates the user if they exist, or creates if they don't
        const response = await fetch(`${supabaseUrl}/rest/v1/users?phone_number=eq.${phoneNumber}`, {
            method: 'PATCH',  // CHANGED FROM POST TO PATCH - updates existing records
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal'
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
            console.log('❌ Response:', responseText);
            
            // If PATCH fails (user doesn't exist), try POST to create new user
            if (response.status === 404 || response.status === 409) {
                console.log('🔄 User not found, trying to create new user...');
                const createResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(userData)
                });
                
                const createResponseText = await createResponse.text();
                console.log('📥 Create user response status:', createResponse.status);
                
                if (createResponse.ok) {
                    console.log('✅ New user created successfully for:', phoneNumber);
                    return true;
                } else {
                    console.log('❌ Failed to create new user:', createResponseText);
                    return false;
                }
            }
            
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error updating Supabase:', error.message);
        return false;
    }
}

// ==================== TEST ENDPOINTS ====================

// Health check endpoint
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Tailor Payments Backend is working!',
        timestamp: new Date().toISOString(),
        status: 'OK',
        endpoints: {
            validate: 'POST /validate',
            confirm: 'POST /confirm',
            test: 'GET /test',
            testUpdate: 'GET /test-update/:phone'
        },
        instructions: 'Use /validate and /confirm for M-Pesa C2B registration'
    });
});

// Manual test endpoint to trigger Supabase update
app.get('/test-update/:phone', async (req, res) => {
    const phone = req.params.phone;
    console.log('🧪 Manual test update for:', phone);
    
    try {
        const success = await updateSupabaseSubscription(phone);
        
        res.json({
            phone: phone,
            updateSuccess: success,
            timestamp: new Date().toISOString(),
            message: success ? 'Subscription activated successfully' : 'Failed to activate subscription',
            backendStatus: 'Active and responsive'
        });
    } catch (error) {
        console.error('❌ Test endpoint error:', error);
        res.json({
            phone: phone,
            updateSuccess: false,
            timestamp: new Date().toISOString(),
            message: 'Backend error occurred',
            backendStatus: 'Error',
            error: error.message
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Tailor Master Pro Payments Backend',
        version: '1.0.0',
        status: 'Running',
        endpoints: {
            validation: 'POST /validate',
            confirmation: 'POST /confirm',
            test: 'GET /test'
        },
        compliance: '✅ URL meets Safaricom requirements (no M-Pesa keywords)',
        monitoring: '✅ UptimeRobot active - backend stays awake 24/7'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Tailor Payments Backend running on port ${PORT}`);
    console.log(`✅ Ready for Safaricom C2B Registration!`);
    console.log(`📍 Validation URL: https://tailor-payments-backend.onrender.com/validate`);
    console.log(`📍 Confirmation URL: https://tailor-payments-backend.onrender.com/confirm`);
    console.log(`📍 Test URL: https://tailor-payments-backend.onrender.com/test`);
    console.log(`🔒 Compliance: URLs are clean (no M-Pesa keywords)`);
    console.log(`👀 Monitoring: UptimeRobot active - backend stays awake`);
});
