const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Bộ nhớ đệm lưu các giao dịch thành công (Làm chơi nên lưu RAM)
// Cấu trúc: { "SP1234": { amount: 50000, time: "..." } }
const paidTransactions = {};

// 1. Cổng nhận Webhook từ SePay
app.post('/webhook/sepay', (req, res) => {
  try {
    const data = req.body;
    console.log('--- Nhận Webhook từ SePay ---');
    console.log(data);

    // Dữ liệu mẫu SePay gửi về thường có:
    // id, gateway, transactionDate, accountNumber, subAccount, amount, transferType, transferContent, referenceCode, content
    
    // Tìm mã giao dịch SPxxxx trong nội dung chuyển khoản
    const content = data.content || data.transferContent || '';
    
    // Lấy mã SP... (ví dụ: SP1234)
    const match = content.match(/(SP[A-Z0-9]+)/i);
    
    if (match) {
      const transactionCode = match[1].toUpperCase();
      
      // Lưu lại mã này đã được thanh toán với số tiền bao nhiêu
      paidTransactions[transactionCode] = {
        amount: data.amount || data.transferAmount || 0,
        time: new Date().toISOString(),
        raw: data
      };
      
      console.log(`=> Đã ghi nhận thanh toán cho mã: ${transactionCode}`);
    } else {
      console.log('=> Không tìm thấy mã SP trong nội dung CK.');
    }

    // Luôn trả về 200 OK để SePay biết đã nhận thành công
    return res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('Lỗi xử lý webhook:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Cổng cho App Flutter kiểm tra xem mã đã được thanh toán chưa
app.get('/api/check-transaction', (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.status(400).json({ success: false, message: 'Thiếu mã giao dịch (code)' });
  }

  const codeUpper = code.toUpperCase();

  if (paidTransactions[codeUpper]) {
    return res.status(200).json({
      success: true,
      paid: true,
      data: paidTransactions[codeUpper]
    });
  } else {
    return res.status(200).json({
      success: true,
      paid: false
    });
  }
});

// 3. Trang chủ hiển thị status
app.get('/', (req, res) => {
  res.send(`
    <h1>SePay Backend đang hoạt động!</h1>
    <p>Sử dụng cổng POST /webhook/sepay để nhận webhook.</p>
    <p>Giao dịch đã lưu: ${Object.keys(paidTransactions).length}</p>
    <ul>
      ${Object.keys(paidTransactions).map(k => `<li>${k} - ${paidTransactions[k].amount} VNĐ</li>`).join('')}
    </ul>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Máy chủ đang chạy tại http://localhost:${PORT}`);
});
