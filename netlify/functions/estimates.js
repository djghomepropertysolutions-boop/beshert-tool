{\rtf1\ansi\ansicpg1252\cocoartf2867
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const \{ google \} = require("googleapis");\
\
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;\
const SHEET_ESTIMATES = "Estimates";\
const SHEET_META      = "Meta";\
\
async function getSheets() \{\
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);\
  const auth = new google.auth.GoogleAuth(\{\
    credentials,\
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],\
  \});\
  return google.sheets(\{ version: "v4", auth \});\
\}\
\
// Ensure header row exists\
async function ensureHeaders(sheets) \{\
  const res = await sheets.spreadsheets.values.get(\{\
    spreadsheetId: SPREADSHEET_ID,\
    range: `$\{SHEET_ESTIMATES\}!A1:Z1`,\
  \});\
  if (!res.data.values || res.data.values.length === 0) \{\
    await sheets.spreadsheets.values.update(\{\
      spreadsheetId: SPREADSHEET_ID,\
      range: `$\{SHEET_ESTIMATES\}!A1`,\
      valueInputOption: "RAW",\
      resource: \{\
        values: [[\
          "contractNumber","dateCreated","docDate",\
          "clientName","clientTitle","clientCompany","clientAddress","clientCity","clientState","clientZip","clientPhone","clientEmail",\
          "jobType","paymentSplit","preparedBy","pm",\
          "totalPrice","priceDesc","optItems","scopeItems","finalPageIds"\
        ]]\
      \}\
    \});\
  \}\
\}\
\
async function getCounter(sheets, key) \{\
  try \{\
    const res = await sheets.spreadsheets.values.get(\{\
      spreadsheetId: SPREADSHEET_ID,\
      range: `$\{SHEET_META\}!A:B`,\
    \});\
    const rows = res.data.values || [];\
    const row  = rows.find(r => r[0] === key);\
    return row ? parseInt(row[1], 10) : 0;\
  \} catch(e) \{ return 0; \}\
\}\
\
async function setCounter(sheets, key, value) \{\
  const res = await sheets.spreadsheets.values.get(\{\
    spreadsheetId: SPREADSHEET_ID,\
    range: `$\{SHEET_META\}!A:B`,\
  \});\
  const rows = (res.data.values || []);\
  const idx  = rows.findIndex(r => r[0] === key);\
  if (idx >= 0) \{\
    await sheets.spreadsheets.values.update(\{\
      spreadsheetId: SPREADSHEET_ID,\
      range: `$\{SHEET_META\}!B$\{idx + 1\}`,\
      valueInputOption: "RAW",\
      resource: \{ values: [[value]] \}\
    \});\
  \} else \{\
    await sheets.spreadsheets.values.append(\{\
      spreadsheetId: SPREADSHEET_ID,\
      range: `$\{SHEET_META\}!A:B`,\
      valueInputOption: "RAW",\
      resource: \{ values: [[key, value]] \}\
    \});\
  \}\
\}\
\
function estToRow(est) \{\
  return [\
    est.contractNumber || "",\
    est.dateCreated    || "",\
    est.docDate        || "",\
    est.client?.name    || "",\
    est.client?.title   || "",\
    est.client?.company || "",\
    est.client?.address || "",\
    est.client?.city    || "",\
    est.client?.state   || "",\
    est.client?.zip     || "",\
    est.client?.phone   || "",\
    est.client?.email   || "",\
    est.jobType        || "",\
    est.paymentSplit   || "",\
    est.preparedBy     || "",\
    est.pm             || "",\
    String(est.totalPrice || 0),\
    est.priceDesc      || "",\
    JSON.stringify(est.optItems    || []),\
    JSON.stringify(est.scopeItems  || []),\
    JSON.stringify(est.finalPageIds|| []),\
  ];\
\}\
\
function rowToEst(row) \{\
  return \{\
    contractNumber: row[0]  || "",\
    dateCreated:    row[1]  || "",\
    docDate:        row[2]  || "",\
    client: \{\
      name:    row[3]  || "",\
      title:   row[4]  || "",\
      company: row[5]  || "",\
      address: row[6]  || "",\
      city:    row[7]  || "",\
      state:   row[8]  || "",\
      zip:     row[9]  || "",\
      phone:   row[10] || "",\
      email:   row[11] || "",\
    \},\
    jobType:       row[12] || "",\
    paymentSplit:  row[13] || "",\
    preparedBy:    row[14] || "",\
    pm:            row[15] || "",\
    totalPrice:    parseFloat(row[16]) || 0,\
    priceDesc:     row[17] || "",\
    optItems:      JSON.parse(row[18] || "[]"),\
    scopeItems:    JSON.parse(row[19] || "[]"),\
    finalPageIds:  JSON.parse(row[20] || "[]"),\
  \};\
\}\
\
const CORS = \{\
  "Access-Control-Allow-Origin":  "*",\
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",\
  "Access-Control-Allow-Headers": "Content-Type",\
  "Content-Type": "application/json",\
\};\
\
exports.handler = async (event) => \{\
  if (event.httpMethod === "OPTIONS") \{\
    return \{ statusCode: 200, headers: CORS, body: "" \};\
  \}\
\
  try \{\
    const sheets = await getSheets();\
    await ensureHeaders(sheets);\
    const params = event.queryStringParameters || \{\};\
\
    // \uc0\u9472 \u9472  GET \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
    if (event.httpMethod === "GET") \{\
      const action = params.action || "list";\
\
      if (action === "list") \{\
        const res  = await sheets.spreadsheets.values.get(\{ spreadsheetId: SPREADSHEET_ID, range: `$\{SHEET_ESTIMATES\}!A2:Z` \});\
        const rows = (res.data.values || []).filter(r => r[0]);\
        return \{ statusCode: 200, headers: CORS, body: JSON.stringify(rows.map(rowToEst)) \};\
      \}\
\
      if (action === "get" && params.contract) \{\
        const res  = await sheets.spreadsheets.values.get(\{ spreadsheetId: SPREADSHEET_ID, range: `$\{SHEET_ESTIMATES\}!A2:Z` \});\
        const rows = (res.data.values || []);\
        const row  = rows.find(r => r[0] === params.contract);\
        if (!row) return \{ statusCode: 404, headers: CORS, body: JSON.stringify(\{ error: "Not found" \}) \};\
        return \{ statusCode: 200, headers: CORS, body: JSON.stringify(rowToEst(row)) \};\
      \}\
\
      if (action === "counter") \{\
        const yr    = new Date().getFullYear();\
        const key   = `est_counter_$\{yr\}`;\
        const count = (await getCounter(sheets, key)) + 1;\
        await setCounter(sheets, key, count);\
        return \{ statusCode: 200, headers: CORS, body: JSON.stringify(\{ count \}) \};\
      \}\
\
      if (action === "inv_counter") \{\
        const yr    = new Date().getFullYear();\
        const key   = `inv_counter_$\{yr\}`;\
        const count = (await getCounter(sheets, key)) + 1;\
        await setCounter(sheets, key, count);\
        return \{ statusCode: 200, headers: CORS, body: JSON.stringify(\{ count \}) \};\
      \}\
\
      return \{ statusCode: 400, headers: CORS, body: JSON.stringify(\{ error: "Unknown action" \}) \};\
    \}\
\
    // \uc0\u9472 \u9472  POST \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \
    if (event.httpMethod === "POST") \{\
      const est = JSON.parse(event.body);\
\
      // Check if contract already exists \uc0\u8594  update row\
      const existing = await sheets.spreadsheets.values.get(\{ spreadsheetId: SPREADSHEET_ID, range: `$\{SHEET_ESTIMATES\}!A2:A` \});\
      const existRows = existing.data.values || [];\
      const rowIdx    = existRows.findIndex(r => r[0] === est.contractNumber);\
\
      if (rowIdx >= 0) \{\
        await sheets.spreadsheets.values.update(\{\
          spreadsheetId: SPREADSHEET_ID,\
          range: `$\{SHEET_ESTIMATES\}!A$\{rowIdx + 2\}`,\
          valueInputOption: "RAW",\
          resource: \{ values: [estToRow(est)] \}\
        \});\
      \} else \{\
        await sheets.spreadsheets.values.append(\{\
          spreadsheetId: SPREADSHEET_ID,\
          range: `$\{SHEET_ESTIMATES\}!A2`,\
          valueInputOption: "RAW",\
          resource: \{ values: [estToRow(est)] \}\
        \});\
      \}\
\
      return \{ statusCode: 200, headers: CORS, body: JSON.stringify(\{ success: true, contractNumber: est.contractNumber \}) \};\
    \}\
\
    return \{ statusCode: 405, headers: CORS, body: JSON.stringify(\{ error: "Method not allowed" \}) \};\
\
  \} catch (err) \{\
    console.error("Function error:", err);\
    return \{ statusCode: 500, headers: CORS, body: JSON.stringify(\{ error: err.message \}) \};\
  \}\
\};}