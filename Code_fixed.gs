// ═══════════════════════════════════════════════════════════════
// ResortDesk — Apps Script Backend (FINAL FIXED)
// All operations use GET to avoid CORS issues
// ═══════════════════════════════════════════════════════════════
//
// SETUP:
// 1. Paste this into Apps Script (opened from your Google Sheet)
// 2. Run setupRegistry() once
// 3. Deploy → New Deployment → Web App
//    Execute as: Me | Who has access: Anyone
// 4. Copy the Web App URL → paste into both HTML files
// ═══════════════════════════════════════════════════════════════

var REGISTRY_SHEET = 'Registry';
var LOG_SHEET      = 'ActivityLog';
var FREE_LIMIT     = 50;

function makeResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════
// SETUP — run once manually
// ══════════════════════════════════════════════════════════════
function setupRegistry() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var reg = ss.getSheetByName(REGISTRY_SHEET);
  if (!reg) { reg = ss.insertSheet(REGISTRY_SHEET); }
  else { reg.clearContents(); }

  reg.appendRow(['Hotel ID','Hotel Name','Location','Phone','Admin Password','Staff PIN','Plan','Active','Created At','Check-In Count']);
  reg.getRange(1,1,1,10).setFontWeight('bold').setBackground('#C9A84C').setFontColor('#000');
  reg.appendRow(['mykonos','Mykonos Cottage Tarkarli','Devbag, Tarkarli, Malvan, Maharashtra','+91 8850076039','mykonos@admin','1234','pro','true',new Date().toLocaleString('en-IN'),0]);

  var log = ss.getSheetByName(LOG_SHEET);
  if (!log) {
    log = ss.insertSheet(LOG_SHEET);
    log.appendRow(['Timestamp','Hotel ID','User','Role','Action','Details']);
    log.getRange(1,1,1,6).setFontWeight('bold');
  }
  Logger.log('Setup complete!');
}

// ══════════════════════════════════════════════════════════════
// doGet — handles ALL operations via GET parameters
// This avoids all CORS issues completely
// ══════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    var p      = e.parameter || {};
    var action = p.action    || 'guests';
    var hotelId= p.hotelId   || '';

    // ── Hotel info (page load) ──────────────────────────────
    if (action === 'hotelInfo') {
      var hotel = getHotel(hotelId);
      if (!hotel) return makeResponse({ status: 'error', message: 'Invalid hotel ID' });
      return makeResponse({ status:'success', name:hotel.name, location:hotel.location, phone:hotel.phone, plan:hotel.plan });
    }

    // ── Login ───────────────────────────────────────────────
    if (action === 'login') {
      var hotel = getHotel(hotelId);
      if (!hotel) return makeResponse({ status:'error', message:'Invalid hotel ID' });
      if (hotel.active !== 'true') return makeResponse({ status:'error', message:'Account suspended.' });

      var role     = p.role     || '';
      var password = p.password || '';
      var userName = p.name     || role;
      var valid    = false;
      if (role === 'admin' && password === hotel.adminPassword) valid = true;
      if (role === 'staff' && password === hotel.staffPin)      valid = true;

      if (!valid) {
        logIt(hotelId, userName, role, 'FAILED_LOGIN', 'Wrong credentials');
        return makeResponse({ status:'error', message:'Wrong password. Please try again.' });
      }
      logIt(hotelId, userName, role, 'LOGIN', 'Success');
      return makeResponse({ status:'success', role:role, name:hotel.name, location:hotel.location, phone:hotel.phone, plan:hotel.plan, loginTime:new Date().toISOString() });
    }

    // ── Load guests ─────────────────────────────────────────
    if (action === 'guests') {
      if (!hotelId) return makeResponse({ status:'error', message:'No hotel ID' });
      return makeResponse({ status:'success', data:getGuests(hotelId) });
    }

    // ── Save new guest (check-in) ───────────────────────────
    if (action === 'checkin') {
      if (!hotelId) return makeResponse({ status:'error', message:'No hotel ID' });
      var hotel = getHotel(hotelId);
      if (!hotel) return makeResponse({ status:'error', message:'Invalid hotel ID' });

      // Free plan limit check
      if (hotel.plan === 'free') {
        var count = parseInt(hotel.checkinCount) || 0;
        if (count >= FREE_LIMIT) return makeResponse({ status:'limit', message:'Free plan limit reached ('+FREE_LIMIT+'). Upgrade to Pro.' });
        bumpCount(hotelId);
      }

      var d = {
        guestId:      p.guestId      || '',
        firstName:    p.firstName    || '',
        lastName:     p.lastName     || '',
        phone:        p.phone        || '',
        city:         p.city         || '',
        checkIn:      p.checkIn      || '',
        checkOut:     p.checkOut     || '',
        room:         p.room         || '',
        source:       p.source       || '',
        adults:       p.adults       || '1',
        children:     p.children     || '0',
        purpose:      p.purpose      || '',
        idType:       p.idType       || '',
        idNumber:     p.idNumber     || '',
        amount:       p.amount       || '0',
        advance:      p.advance      || '0',
        balance:      p.balance      || '0',
        payMode:      p.payMode      || '',
        payStatus:    p.payStatus    || '',
        txnId:        p.txnId        || '',
        requests:     p.requests     || '',
        notes:        p.notes        || '',
        registeredAt: p.registeredAt || new Date().toLocaleString('en-IN'),
        registeredBy: p.registeredBy || '',
      };
      saveGuest(hotelId, d);
      logIt(hotelId, d.registeredBy, 'staff', 'CHECK_IN', d.guestId+' — '+d.firstName+' '+d.lastName);
      return makeResponse({ status:'success', guestId:d.guestId });
    }

    // ── Checkout ────────────────────────────────────────────
    if (action === 'checkout') {
      setStatus(hotelId, p.guestId, 'Checked Out');
      logIt(hotelId, p.doneBy||'staff', 'staff', 'CHECK_OUT', p.guestId);
      return makeResponse({ status:'success' });
    }

    // ── Update guest ────────────────────────────────────────
    if (action === 'update') {
      var d = {
        guestId:p.guestId, firstName:p.firstName, lastName:p.lastName,
        phone:p.phone, city:p.city, checkIn:p.checkIn, checkOut:p.checkOut,
        room:p.room, source:p.source, adults:p.adults, children:p.children,
        purpose:p.purpose, idType:p.idType, idNumber:p.idNumber,
        amount:p.amount, advance:p.advance, balance:p.balance,
        payMode:p.payMode, payStatus:p.payStatus, txnId:p.txnId,
        requests:p.requests, notes:p.notes, status:p.status,
      };
      updateGuest(hotelId, d);
      logIt(hotelId, p.updatedBy||'staff', 'staff', 'UPDATE', p.guestId);
      return makeResponse({ status:'success' });
    }

    // ── Delete guest ────────────────────────────────────────
    if (action === 'delete') {
      deleteGuest(hotelId, p.guestId);
      logIt(hotelId, p.deletedBy||'admin', 'admin', 'DELETE', p.guestId);
      return makeResponse({ status:'success' });
    }

    return makeResponse({ status:'error', message:'Unknown action: '+action });

  } catch(err) {
    return makeResponse({ status:'error', message:err.toString() });
  }
}

// ══════════════════════════════════════════════════════════════
// doPost — kept for compatibility but routes to doGet
// ══════════════════════════════════════════════════════════════
function doPost(e) {
  return doGet(e);
}

// ══════════════════════════════════════════════════════════════
// REGISTRY HELPERS
// ══════════════════════════════════════════════════════════════
function getHotel(hotelId) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var reg = ss.getSheetByName(REGISTRY_SHEET);
  if (!reg) return null;
  var rows = reg.getDataRange().getValues();
  if (rows.length < 2) return null;
  var h = rows[0];

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][h.indexOf('Hotel ID')]).trim() === String(hotelId).trim()) {
      return {
        id:            String(rows[i][h.indexOf('Hotel ID')]),
        name:          String(rows[i][h.indexOf('Hotel Name')]),
        location:      String(rows[i][h.indexOf('Location')]),
        phone:         String(rows[i][h.indexOf('Phone')]),
        adminPassword: String(rows[i][h.indexOf('Admin Password')]),
        staffPin:      String(rows[i][h.indexOf('Staff PIN')]),
        plan:          String(rows[i][h.indexOf('Plan')]).toLowerCase().trim(),
        active:        String(rows[i][h.indexOf('Active')]).toLowerCase().trim(),
        checkinCount:  rows[i][h.indexOf('Check-In Count')] || 0,
      };
    }
  }
  return null;
}

function bumpCount(hotelId) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var reg  = ss.getSheetByName(REGISTRY_SHEET);
  var rows = reg.getDataRange().getValues();
  var h    = rows[0];
  var idCol    = h.indexOf('Hotel ID');
  var countCol = h.indexOf('Check-In Count');
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]).trim() === String(hotelId).trim()) {
      reg.getRange(i+1, countCol+1).setValue((parseInt(rows[i][countCol])||0)+1);
      return;
    }
  }
}

// ══════════════════════════════════════════════════════════════
// GUEST HELPERS
// ══════════════════════════════════════════════════════════════
var HEADERS = ['Guest ID','First Name','Last Name','Phone','City','Check-In','Check-Out','Room','Booking Source','Adults','Children','Purpose','ID Type','ID Number','Total Amount','Advance Paid','Balance Due','Payment Mode','Payment Status','Transaction No','Special Requests','Staff Notes','Registered At','Registered By','Status'];

function getOrMakeSheet(hotelId) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(hotelId);
  if (!sheet) {
    sheet = ss.insertSheet(hotelId);
    sheet.appendRow(HEADERS);
    sheet.getRange(1,1,1,HEADERS.length).setFontWeight('bold').setBackground('#1C2333').setFontColor('#C9A84C');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getGuests(hotelId) {
  var sheet = getOrMakeSheet(hotelId);
  var rows  = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  var h = rows[0];
  var data = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    data.push({
      guestId:      String(r[h.indexOf('Guest ID')]        ||''),
      firstName:    String(r[h.indexOf('First Name')]      ||''),
      lastName:     String(r[h.indexOf('Last Name')]       ||''),
      phone:        String(r[h.indexOf('Phone')]           ||''),
      city:         String(r[h.indexOf('City')]            ||''),
      checkIn:      String(r[h.indexOf('Check-In')]        ||''),
      checkOut:     String(r[h.indexOf('Check-Out')]       ||''),
      room:         String(r[h.indexOf('Room')]            ||''),
      source:       String(r[h.indexOf('Booking Source')]  ||''),
      adults:       String(r[h.indexOf('Adults')]          ||'1'),
      children:     String(r[h.indexOf('Children')]        ||'0'),
      purpose:      String(r[h.indexOf('Purpose')]         ||''),
      idType:       String(r[h.indexOf('ID Type')]         ||''),
      idNumber:     String(r[h.indexOf('ID Number')]       ||''),
      amount:       String(r[h.indexOf('Total Amount')]    ||'0'),
      advance:      String(r[h.indexOf('Advance Paid')]    ||'0'),
      balance:      String(r[h.indexOf('Balance Due')]     ||'0'),
      payMode:      String(r[h.indexOf('Payment Mode')]    ||''),
      payStatus:    String(r[h.indexOf('Payment Status')]  ||''),
      txnId:        String(r[h.indexOf('Transaction No')]  ||''),
      requests:     String(r[h.indexOf('Special Requests')]||''),
      notes:        String(r[h.indexOf('Staff Notes')]     ||''),
      registeredAt: String(r[h.indexOf('Registered At')]   ||''),
      registeredBy: String(r[h.indexOf('Registered By')]   ||''),
      status:       String(r[h.indexOf('Status')]          ||'Checked In'),
    });
  }
  return data;
}

function saveGuest(hotelId, d) {
  var sheet = getOrMakeSheet(hotelId);
  sheet.appendRow([
    d.guestId||'', d.firstName||'', d.lastName||'', d.phone||'', d.city||'',
    d.checkIn||'', d.checkOut||'', d.room||'', d.source||'',
    d.adults||1,   d.children||0,  d.purpose||'',
    d.idType||'',  d.idNumber||'',
    d.amount||0,   d.advance||0,   d.balance||0,
    d.payMode||'', d.payStatus||'',d.txnId||'',
    d.requests||'',d.notes||'',
    d.registeredAt||new Date().toLocaleString('en-IN'),
    d.registeredBy||'', 'Checked In'
  ]);
}

function updateGuest(hotelId, d) {
  var sheet = getOrMakeSheet(hotelId);
  var rows  = sheet.getDataRange().getValues();
  var h     = rows[0];
  var idCol = h.indexOf('Guest ID');
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(d.guestId)) {
      var map = {
        'First Name':d.firstName,'Last Name':d.lastName,'Phone':d.phone,'City':d.city,
        'Check-In':d.checkIn,'Check-Out':d.checkOut,'Room':d.room,'Booking Source':d.source,
        'Adults':d.adults,'Children':d.children,'Purpose':d.purpose,
        'ID Type':d.idType,'ID Number':d.idNumber,
        'Total Amount':d.amount,'Advance Paid':d.advance,'Balance Due':d.balance,
        'Payment Mode':d.payMode,'Payment Status':d.payStatus,'Transaction No':d.txnId,
        'Special Requests':d.requests,'Staff Notes':d.notes,
        'Status':d.status||rows[i][h.indexOf('Status')]
      };
      var newRow = h.map(function(col){ return map.hasOwnProperty(col)?map[col]:rows[i][h.indexOf(col)]; });
      sheet.getRange(i+1,1,1,newRow.length).setValues([newRow]);
      return;
    }
  }
}

function setStatus(hotelId, guestId, newStatus) {
  var sheet = getOrMakeSheet(hotelId);
  var rows  = sheet.getDataRange().getValues();
  var h     = rows[0];
  var idCol = h.indexOf('Guest ID');
  var stCol = h.indexOf('Status');
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(guestId)) {
      sheet.getRange(i+1, stCol+1).setValue(newStatus); return;
    }
  }
}

function deleteGuest(hotelId, guestId) {
  var sheet = getOrMakeSheet(hotelId);
  var rows  = sheet.getDataRange().getValues();
  var h     = rows[0];
  var idCol = h.indexOf('Guest ID');
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(guestId)) {
      sheet.deleteRow(i+1); return;
    }
  }
}

// ══════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ══════════════════════════════════════════════════════════════
function logIt(hotelId, user, role, action, details) {
  try {
    var log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET);
    if (log) log.appendRow([new Date().toLocaleString('en-IN'), hotelId, user, role, action, details]);
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ══════════════════════════════════════════════════════════════
function testGetHotel() {
  var hotel = getHotel('mykonos');
  Logger.log(JSON.stringify(hotel));
}

function testSaveGuest() {
  saveGuest('mykonos', {
    guestId:'MYK-TEST-002', firstName:'Test', lastName:'Guest',
    phone:'+91 99999 00000', city:'Mumbai',
    checkIn:'2026-03-29', checkOut:'2026-03-30',
    room:'Mykonos Cottage', source:'Direct / Walk-in',
    adults:2, children:0, purpose:'Leisure / Vacation',
    idType:'Aadhaar Card', idNumber:'1234 5678 9012',
    amount:5000, advance:2000, balance:3000,
    payMode:'UPI', payStatus:'Partial', txnId:'UPI123',
    requests:'Early check-in', notes:'Test entry',
    registeredAt:new Date().toLocaleString('en-IN'), registeredBy:'Admin'
  });
  Logger.log('Saved! Check mykonos sheet tab.');
}
