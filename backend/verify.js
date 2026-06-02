const API_URL = 'http://localhost:3001/api';

async function fetchJson(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_URL}/${path.startsWith('/') ? path.slice(1) : path}`, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status} on ${method} ${path}: ${text}`);
  }
  return response.json().catch(() => null);
}

async function run() {
  console.log('=== STARTING SETTLEMENT VERIFICATION SCRIPT ===');
  
  // 1. Login
  console.log('Logging in as alvinmonir411@gmail.com...');
  const loginRes = await fetchJson('auth/login', 'POST', {
    identifier: 'alvinmonir411@gmail.com',
    password: '136633'
  });
  
  const token = loginRes.token || loginRes.accessToken;
  if (!token) {
    throw new Error('Login failed, no token received: ' + JSON.stringify(loginRes));
  }
  console.log('Logged in successfully!');

  // 2. Fetch routes, shops, companies, products
  console.log('Fetching active master data...');
  const routes = await fetchJson('routes', 'GET', null, token);
  const companies = await fetchJson('companies', 'GET', null, token);
  const products = await fetchJson('products', 'GET', null, token);
  const users = await fetchJson('users', 'GET', null, token); 
  const personnel = await fetchJson('delivery-ops/personnel', 'GET', null, token);

  if (!routes.length || !companies.length || !products.length) {
    throw new Error('Missing routes, companies, or products in database.');
  }

  const selectedRoute = routes[0];
  const selectedCompany = companies[0];
  const selectedProduct = products.find(p => p.isActive !== false) || products[0];
  
  // Find or create a shop for the route
  const shops = await fetchJson(`shops?routeId=${selectedRoute.id}`, 'GET', null, token);
  let selectedShop = shops.length ? shops[0] : null;
  if (!selectedShop) {
    console.log(`Creating a new shop on route ${selectedRoute.name}...`);
    selectedShop = await fetchJson('shops', 'POST', {
      name: 'Verification Test Shop',
      ownerName: 'Test Owner',
      phone: '01700000000',
      address: 'Dhaka',
      routeId: selectedRoute.id,
      companyId: selectedCompany.id
    }, token);
  }

  console.log(`Using Master Data:
  - Route: ${selectedRoute.name} (ID: ${selectedRoute.id})
  - Company: ${selectedCompany.name} (ID: ${selectedCompany.id})
  - Shop: ${selectedShop.name} (ID: ${selectedShop.id})
  - Product: ${selectedProduct.name} (ID: ${selectedProduct.id}, Unit Price: ${selectedProduct.price || selectedProduct.unitPrice || 958})`);

  const unitPrice = Number(selectedProduct.price || selectedProduct.unitPrice || 958);

  // 3. Create an order with final amount BDT 958.00 (or close)
  console.log('Creating order...');
  const orderDate = new Date().toISOString().split('T')[0];
  
  // Calculate quantity to get total of BDT 958.00
  const qty = 958 / unitPrice;
  const orderPayload = {
    orderDate,
    companyId: selectedCompany.id,
    routeId: selectedRoute.id,
    shopId: selectedShop.id,
    discountType: 'FIXED',
    discountValue: 0,
    advancePaid: 0,
    items: [
      {
        productId: selectedProduct.id,
        quantity: qty,
        freeQuantity: 0,
        unitPrice: unitPrice,
        discountType: 'FIXED',
        discountValue: 0
      }
    ]
  };
  
  const createdOrder = await fetchJson('orders', 'POST', orderPayload, token);
  console.log(`Order created successfully! ID: ${createdOrder.id}, Grand Total: BDT ${createdOrder.grandTotal}`);

  // 4. Create Dispatch Batch
  console.log('Creating dispatch batch...');
  
  // Find a delivery man user
  const deliveryManUser = users.find(u => u.role === 'DELIVERY_MAN' || u.role === 'Super_admin' || u.role === 'Admin') || users[0];
  const deliveryPerson = personnel[0] || { id: 1 };
  
  const batchPayload = {
    dispatchDate: orderDate,
    companyId: selectedCompany.id,
    routeId: selectedRoute.id,
    deliveryPersonId: deliveryPerson.id,
    assignedDeliveryManId: deliveryManUser.id,
    orderIds: [createdOrder.id]
  };
  
  const batch = await fetchJson('delivery-ops/batches', 'POST', batchPayload, token);
  console.log(`Dispatch Batch created! ID: ${batch.id}, Batch No: ${batch.batchNo}, Status: ${batch.status}`);

  // 5. Dispatch Batch to field
  console.log('Dispatching batch to field...');
  const dispatchedBatch = await fetchJson(`delivery-ops/batches/${batch.id}/dispatch`, 'PATCH', null, token);
  console.log(`Batch Dispatched! Status: ${dispatchedBatch.status}`);

  // 6. Confirm & Settle Batch with:
  // - actualCashReceived: BDT 558.00
  // - collections: [{ orderId: <orderId>, collectedAmount: 558 }]
  // - dueEntries: [{ orderId: <orderId>, amount: 400 }]
  console.log('Settling batch...');
  const settlePayload = {
    collections: [
      {
        orderId: createdOrder.id,
        collectedAmount: 558,
        paymentMode: 'CASH'
      }
    ],
    dueEntries: [
      {
        orderId: createdOrder.id,
        amount: 400,
        note: 'Added during verification'
      }
    ],
    actualCashReceived: 558
  };

  const settledBatch = await fetchJson(`delivery-ops/batches/${batch.id}/settlement`, 'POST', settlePayload, token);
  console.log(`\n=== SETTLED BATCH SUMMARY ===`);
  console.log(`Batch No: ${settledBatch.batchNo}`);
  console.log(`Status: ${settledBatch.status}`);
  console.log(`Final Sold Value: BDT ${settledBatch.finalSoldValue}`);
  console.log(`Total Collected Amount: BDT ${settledBatch.totalCollectedAmount}`);
  console.log(`Total Due Amount: BDT ${settledBatch.totalDueAmount}`);
  console.log(`Shortage/Excess: BDT ${settledBatch.shortageOrExcess}`);
  console.log(`Settlement Note: ${settledBatch.settlementNote}`);
  
  console.log(`\nSettled Orders:`);
  settledBatch.orders.forEach(bo => {
    console.log(`  - Order ID: ${bo.orderId}`);
    console.log(`    isSettled: ${bo.isSettled}`);
    console.log(`    collectedAmount: BDT ${bo.collectedAmount}`);
    console.log(`    dueAmount: BDT ${bo.dueAmount}`);
  });

  // Verify constraints
  const batchDueResult = Number(settledBatch.totalDueAmount);
  const batchCollectedResult = Number(settledBatch.totalCollectedAmount);
  
  if (batchDueResult === 400 && batchCollectedResult === 558) {
    console.log('\n✅ SUCCESS: Ledger values match expectations exactly!');
  } else {
    console.error(`\n❌ FAILURE: Mismatched ledger values. Expected due=400, collected=558. Got due=${batchDueResult}, collected=${batchCollectedResult}`);
  }
  
  // 7. Check Due page list
  console.log('\nChecking dues list...');
  const dues = await fetchJson('dues', 'GET', null, token);
  const matchingDue = dues.find(d => d.orderId === createdOrder.id);
  if (matchingDue) {
    console.log(`Found matching due record!
    - Shop: ${matchingDue.shop?.name || matchingDue.shopId}
    - SR: ${matchingDue.srName || matchingDue.srId}
    - Due Amount: BDT ${matchingDue.dueAmount}
    - Remaining Due: BDT ${matchingDue.remainingDue}
    - Status: ${matchingDue.status}`);
  } else {
    console.warn('⚠️ Warning: No matching due record found in the dues list.');
  }
}

run().catch(err => {
  console.error('Test Execution Error:', err);
});
