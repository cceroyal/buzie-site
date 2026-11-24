/**
 * BUZIE — посредник между формой на сайте и Telegram-ботом.
 *
 * Где живёт: Google Apps Script (script.google.com) в вашем Google-аккаунте.
 * Токен бота хранится ТОЛЬКО здесь, в «Свойствах скрипта», и не попадает на сайт.
 *
 * Свойства скрипта (Настройки проекта → Свойства скрипта):
 *   TELEGRAM_TOKEN   — токен бота от @BotFather (обязательно)
 *   TELEGRAM_CHAT_ID — куда присылать заявки: ваш чат или группа (обязательно)
 *   SHEET_ID         — id Google-таблицы для копии заявок (необязательно)
 */

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TELEGRAM_TOKEN');
  var chatId = props.getProperty('TELEGRAM_CHAT_ID');

  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) {}

  // Ловушка для спам-ботов: это поле на сайте скрыто, человек его не заполняет.
  if (d.website) return json_({ ok: true });

  var clean = function (v) { return String(v || '').trim().slice(0, 500); };
  if (!clean(d.company) || !clean(d.contact)) return json_({ ok: false, error: 'empty' });

  var text = [
    '🍒🥭 Новая заявка BUZIE',
    '',
    '🏪 ' + clean(d.company) + (d.type ? ' (' + clean(d.type) + ')' : ''),
    '👤 ' + clean(d.name),
    '📞 ' + clean(d.contact),
    d.comment ? '💬 ' + clean(d.comment) : ''
  ].filter(function (s) { return s !== null; }).join('\n').trim();

  // Необязательно: копия заявки в Google-таблицу.
  var sheetId = props.getProperty('SHEET_ID');
  if (sheetId) {
    try {
      SpreadsheetApp.openById(sheetId).getSheets()[0]
        .appendRow([new Date(), clean(d.company), clean(d.type), clean(d.name), clean(d.contact), clean(d.comment)]);
    } catch (err) {}
  }

  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    payload: { chat_id: chatId, text: text, disable_web_page_preview: 'true' },
    muteHttpExceptions: true
  });
  return json_({ ok: res.getResponseCode() === 200 });
}

/** Проверка из браузера: откройте адрес веб-приложения — должно быть {"ok":true,"service":"buzie-form"}. */
function doGet() {
  return json_({ ok: true, service: 'buzie-form' });
}

/**
 * Запустите один раз вручную (кнопка «Выполнить»), чтобы узнать TELEGRAM_CHAT_ID:
 * сначала напишите боту любое сообщение (или добавьте бота в группу и напишите там),
 * затем запустите эту функцию и посмотрите «Журнал выполнения» — там будет chat id.
 */
function findChatId() {
  var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates', { muteHttpExceptions: true });
  var data = JSON.parse(res.getContentText());
  (data.result || []).forEach(function (u) {
    var m = u.message || u.channel_post || u.my_chat_member;
    if (m && m.chat) Logger.log('chat id: ' + m.chat.id + '  —  ' + (m.chat.title || m.chat.first_name || ''));
  });
  if (!data.result || !data.result.length) Logger.log('Пусто: сначала напишите боту сообщение и запустите снова.');
}

/** Запустите вручную, чтобы проверить: в Telegram должно прийти тестовое сообщение. */
function testMessage() {
  doPost({ postData: { contents: JSON.stringify({ company: 'Тестовая кофейня', type: 'Кофейня', name: 'Проверка', contact: '+7 000 000-00-00', comment: 'Это тест формы сайта' }) } });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
