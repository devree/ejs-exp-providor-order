(function () {
  'use strict';

  var errorBox = document.getElementById('error-box');
  var resetAllBtn = document.getElementById('btn-reset-all');

  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function clearError() {
    if (!errorBox) return;
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }

  function setBusy(busy) {
    var btns = document.querySelectorAll('.btn-reset, #btn-reset-all');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = busy;
  }

  function post(url) {
    return fetch(url, { method: 'POST', headers: { Accept: 'application/json' } }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) {
          var msg = body && body.error && body.error.message ? body.error.message : 'เกิดข้อผิดพลาด (' + res.status + ')';
          throw new Error(msg);
        }
        return body && body.data ? body.data : {};
      });
    });
  }

  function run(url, onDone) {
    clearError();
    setBusy(true);
    post(url).then(onDone, function (err) {
      showError(err && err.message ? err.message : 'เกิดข้อผิดพลาด');
      setBusy(false);
    });
  }

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || !target.closest) return;
    var btn = target.closest('.btn-reset');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    if (!id) return;
    run('/api/admin/orders/' + encodeURIComponent(id) + '/reset-pulled', function () {
      window.location.reload();
    });
  });

  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', function () {
      var provider = resetAllBtn.getAttribute('data-provider') || '';
      var label = resetAllBtn.getAttribute('data-provider-label') || provider;
      var text = provider
        ? 'ยืนยันรีเซ็ตสถานะการถูกดึงของคำสั่งซื้อทั้งหมดของ ' + label + '?'
        : 'ยืนยันรีเซ็ตสถานะการถูกดึงของคำสั่งซื้อทั้งหมด (ทุก Provider)?';
      if (!window.confirm(text)) return;
      var url = '/api/admin/orders/reset-pulled' + (provider ? '?provider=' + encodeURIComponent(provider) : '');
      run(url, function (data) {
        window.alert('รีเซ็ตแล้ว ' + (data && data.resetCount !== undefined ? data.resetCount : 0) + ' รายการ');
        window.location.reload();
      });
    });
  }
})();
