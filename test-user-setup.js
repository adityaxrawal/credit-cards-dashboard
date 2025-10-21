// Simple test user creation script
// This can be run in the browser console on the login page

const createTestUser = async () => {
  const email = 'test@example.com';
  const password = 'testpassword123';
  
  console.log('Creating test user with email:', email);
  
  // Fill in the form fields
  const emailInput = document.querySelector('input[type="email"]');
  const passwordInput = document.querySelector('input[type="password"]');
  
  if (emailInput && passwordInput) {
    emailInput.value = email;
    passwordInput.value = password;
    
    // Trigger change events
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    console.log('Form fields filled. Click "Sign Up" button to create the user.');
  } else {
    console.error('Could not find email or password input fields');
  }
};

// Run the function
createTestUser();