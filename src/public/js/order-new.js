'use strict';

(function () {
  var form = document.getElementById('order-form');
  var providerEl = document.getElementById('provider');
  var countEl = document.getElementById('productCount');
  var btn = document.getElementById('submit-btn');
  var errorBox = document.getElementById('error-box');
  var resultCard = document.getElementById('result-card');
  var maxItems = Number(countEl.getAttribute('data-max')) || 10;
  var BTN_TEXT = 'Gen Order Data';

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function row(label, valueNode) {
    var p = el('p');
    p.appendChild(el('strong', null, label + ': '));
    p.appendChild(typeof valueNode === 'string' ? document.createTextNode(valueNode) : valueNode);
    return p;
  }

  function formatMoney(amount, currency) {
    try {
      return new Intl.NumberFormat('th-TH', { style: 'currency', currency: currency }).format(amount);
    } catch (e) {
      return String(amount) + ' ' + currency;
    }
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleString('th-TH');
  }

  function renderResult(order) {
    resultCard.textContent = '';
    resultCard.appendChild(el('div', 'card-title', 'สร้างออร์เดอร์สำเร็จ'));
    resultCard.appendChild(row('Order ID', el('code', null, order.externalOrderId)));
    var provider = String(order.provider);
    var badgeClass = /^[a-z]+$/.test(provider) ? ' badge-' + provider : '';
    resultCard.appendChild(row('Provider', el('span', 'badge' + badgeClass, provider)));
    resultCard.appendChild(row('จำนวนสินค้า', String(order.itemCount)));
    resultCard.appendChild(row('ยอดรวม', formatMoney(order.totalAmount, order.currency)));
    resultCard.appendChild(row('เวลาสร้าง', formatDate(order.createdAt)));
    var link = el('a', 'btn btn-secondary', 'ดูรายละเอียด');
    link.href = '/orders/' + encodeURIComponent(String(order.id));
    resultCard.appendChild(link);
    resultCard.classList.remove('hidden');
  }

  function setPending(pending) {
    btn.disabled = pending;
    btn.textContent = pending ? 'กำลังสร้าง...' : BTN_TEXT;
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    clearError();

    var raw = countEl.value.trim();
    var n = Number(raw);
    if (raw === '' || !Number.isInteger(n) || n < 1 || n > maxItems) {
      resultCard.classList.add('hidden');
      showError('จำนวนสินค้าต้องเป็นจำนวนเต็มระหว่าง 1 ถึง ' + maxItems);
      return;
    }

    setPending(true);
    fetch('/api/admin/orders/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerEl.value, productCount: n }),
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = null;
          }
          return { status: res.status, data: data };
        });
      })
      .then(function (r) {
        if (r.status === 201 && r.data && r.data.data) {
          renderResult(r.data.data);
        } else {
          resultCard.classList.add('hidden');
          var msg = r.data && r.data.error && r.data.error.message;
          showError(msg || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (' + r.status + ')');
        }
      })
      .catch(function () {
        resultCard.classList.add('hidden');
        showError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
      })
      .then(function () {
        setPending(false);
      });
  });
})();
