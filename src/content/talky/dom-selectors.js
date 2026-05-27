// TESSERACT - Centralized DOM Selectors
// All talkytimes.com CSS selectors in one place.
// Import this file FIRST in content_scripts in manifest.json

const TALK_Y = {
  // ─── LINKS & ANCHORS ───
  ALL_LINKS: 'a[href]',
  LINKS_WITH_PROFILE: 'a[href*="/profile/"], a[href*="/user/"], a[href*="/member/"]',
  LINKS_WITH_MAIL: '[href*="/mails"], [href*="/email"], [class*="nav"] [class*="mail"], [class*="menu"] [class*="mail"]',

  // ─── IDs IN DATA ATTRIBUTES ───
  DATA_ANY_ID: '[data-id], [data-user-id], [data-contact-id], [data-member-id], [data-profile-id]',
  DATA_UID: '[data-test-uid]',
  DATA_LIMITS_TAB: '[data-test-id*="has_limits"]',
  DATA_LIMITS_TAB_FALLBACK: '[class*="has_limits"], [data-test-id*="active-limit"], [data-test-id*="ActiveLimit"]',

  // ─── INPUT & CHAT ───
  CHAT_TEXTAREA: 'textarea[class*="chat"], textarea[class*="message"], textarea[placeholder*="message"], textarea[placeholder*="escribe"], textarea[placeholder*="type"], textarea[placeholder*="Write"]',
  CHAT_CONTENTEDITABLE: 'div[contenteditable="true"][class*="chat"], div[contenteditable="true"][class*="message"]',
  CHAT_INPUT_SIMPLE: 'input[class*="chat"], input[class*="message"]',
  CHAT_INPUT_ID: '#chatInput, #messageInput, #msgInput, textarea.chat-input',
  CHAT_INPUT_WRAPPER: '[class*="chat-input"] textarea, [class*="chat-input"] input, [class*="message-input"] textarea, [class*="message-input"] input',
  CHAT_INPUT_ACTIVE: '[class*="active-chat"] textarea, [class*="active-chat"] input, [class*="current-chat"] textarea, [class*="current-chat"] input, [class*="conversation-active"] textarea, [class*="conversation-active"] input, [class*="chat-active"] textarea, [class*="chat-active"] input',
  ANY_TEXTAREA: 'textarea',

  // ─── SEND BUTTONS ───
  SEND_BTN_CLASS: 'button[class*="send"], [class*="send-btn"], [class*="btn-send"]',
  SEND_BTN_SUBMIT: '[type="submit"][class*="chat"], [type="submit"][class*="message"]',
  SEND_BTN_ARIA: 'button[aria-label*="send"], button[aria-label*="enviar"]',
  SEND_BTN_ID: '#sendButton, #btnSend, #chatSend',
  SEND_BTN_ALT_FALLBACK: '[class*="send"]:not(button), [class*="submit"]:not(button)',
  ALL_BUTTONS: 'button, [role="button"]',

  // ─── EMAIL / LETTER ───
  EMAIL_ICON_SVG: 'svg#Email, svg[id="Email"]',
  EMAIL_TEXTAREA: 'textarea[class*="letter"], textarea[class*="email"], textarea[class*="mail"], textarea[class*="carta"], textarea[placeholder*="letter"], textarea[placeholder*="email"], textarea[placeholder*="carta"]',
  EMAIL_CONTENTEDITABLE: 'div[contenteditable="true"][class*="letter"], div[contenteditable="true"][class*="email"]',
  EMAIL_COMPOSE: '[class*="compose"] textarea, [class*="compose"] [contenteditable="true"]',
  EMAIL_BODY: '[class*="email-body"] textarea, [class*="email-body"] [contenteditable="true"], [class*="mail-body"] textarea, [class*="mail-body"] [contenteditable="true"]',
  EMAIL_LETTER_CONTENT: '.letter-content textarea, .letter-content [contenteditable="true"]',
  EMAIL_SEND_BTN: 'button[class*="send-letter"], button[class*="send-email"], button[class*="send-mail"], button[aria-label*="send letter"], button[aria-label*="send email"], button[aria-label*="enviar carta"], [class*="letter"] button[class*="send"], [class*="email"] button[class*="send"], [class*="mail"] button[class*="send"], button[type="submit"][class*="letter"], button[type="submit"][class*="email"]',
  EMAIL_SEND_BTN_DATA_TEST: '[data-test-id*="send-mail"]',
  EMAIL_SEND_BTN_CLASS: 'button.send-button',
  EMAIL_SEND_BTN_ID: '#sendLetterBtn, #sendEmailBtn',

  // ─── CONVERSATION / DIALOG ITEMS ───
  DIALOG_ITEM_CONTENT: '[class*="dialog-item-content"]',
  DIALOG_ITEMS: '[class*="dialog-item-content"], [class*="dialog-item"], [class*="conversation-item"]',
  DIALOG_ITEM_NAME: '.dialog-item__name, [class*="name"]:not([class*="wrapper"]):not([class*="row"])',
  DIALOG_NAME_WRAPPER: '.dialog-item__name-wrapper, .dialog-item__name-row, [class*="name-wrapper"], [class*="name-row"]',
  TIMER_ELEMENT: '.tess-resp-timer',

  // ─── CONTACT LIST ───
  CONTACT_LIST_PRIMARY: '[class*="contact-list"], [class*="chat-list"], [class*="conversation"], [class*="dialog"], [class*="messages"]',
  CONTACT_LIST_INBOX: '[class*="inbox"], [class*="mail-list"], [class*="letter-list"], [class*="message-list"]',
  CONTACT_LIST_ALT: 'ul, [class*="list"], [role="list"]',
  CONTACT_LIST_ALT2: 'ul, [class*="list"], [role="list"], [class*="items"], [class*="container"] > div, main',
  CONTACT_ITEMS: '[class*="contact"], [class*="user"], [class*="item"], [class*="dialog-item"], [class*="thread"], li, [class*="row"], [class*="member"]',
  CONTACT_ITEMS_SHORT: '[class*="contact"], [class*="user"], [class*="item"], [class*="dialog-item"], [class*="thread"], li, [class*="row"]',
  CONTACT_MAIL_ITEMS: '[class*="item"], [class*="mail"], [class*="letter"], li, [class*="row"], [class*="message"]',

  // ─── SEARCH / SCAN SECTIONS ───
  SECTION_ACTIVE_LIMIT: '[class*="active-limit"], [class*="activeLimit"], [class*="ActiveLimit"], [class*="active"][class*="limit"], [id*="active-limit"], [id*="activeLimit"]',
  SECTION_MAIL_TABLE: 'table[class*="mail"], table[class*="message"], [class*="mail-list"], [class*="message-list"]',
  SECTION_LIST: '[class*="contact-list"], [class*="user-list"], section, div[class*="list"], div[class*="table"]',
  SECTION_INBOX: '[class*="inbox"], [class*="conversation"], [class*="thread"], [class*="mail-item"], [class*="msg-list"], [class*="chat-list"], [class*="feed"], [class*="letter-wrap"], [class*="mail-box"]',
  SECTION_MAIL_BOX_ITEM: '[class*="mail-box-item"], [class*="mail-item"]',

  // ─── PAGE TYPE DETECTION ───
  PAGE_SEARCH: '[class*="search-result"], [class*="browse-result"], [class*="profile-card"]',
  PAGE_CONTACT_LIST: '[class*="contact-list"], [class*="chat-list"], [class*="conversation-list"]',
  PAGE_MAIL_LIST: '[class*="mail-list"], [class*="inbox-list"], [class*="letter-list"]',
  PAGE_CHAT: '[class*="chat"]',
  PAGE_MESSAGES: '[class*="chat"], [class*="message"], [class*="conversation"], [class*="dialog"], [class*="conversation-list"], [class*="msg-area"]',
  PAGE_CHAT_BODY: '[class*="messages"], [class*="chat-body"], [class*="conversation-content"], [class*="message-list"], [class*="chat-area"], [class*="msg-container"]',

  // ─── NOTIFICATIONS / EVENTS ───
  NOTIFICATION_CONTAINER: '[class*="notification"], [class*="alert"], [class*="toast"], [class*="message-list"], [class*="inbox"]',
  MESSAGE_AREAS: '[class*="message"], [class*="conversation"], [class*="inbox"], [class*="mailbox"]',

  // ─── PROFILE ───
  PROFILE_DETAIL: '[class*="profile-detail"], [class*="user-profile"], [class*="member-info"], [class*="contact-info"]',
  PROFILE_BIO: '[class*="bio"], [class*="description"], [class*="about"]',
  PROFILE_NAME: '[class*="name"], [class*="title"]',
  PROFILE_LOCATION: '[class*="location"], [class*="city"]',
  PROFILE_CHAT_HEADER: '[class*="chat-header"] [data-id], [class*="profile-header"] [data-id], [class*="conversation-header"] [data-id], [class*="member-info"] [data-id], [id*="chat-profile"] [data-id], [class*="active-chat"] [data-id]',
  PROFILE_CHAT_HEADER_LINK: '[class*="chat-header"] a[href], [class*="profile-header"] a[href], [class*="conversation-header"] a[href]',
  PROFILE_IMAGES: 'img[class*="avatar"], img[class*="profile"], img[class*="photo"], img[alt]:not([alt=""])',
  PROFILE_IMAGES_SHORT: 'img[class*="photo"], img[class*="avatar"], img[src]',
  PROFILE_LINKS: 'a[href*="profile"], a[href*="perfil"], a[href*="my-"], a[href*="account"]',

  // ─── PROFILE DATA-TEST-ID SELECTORS ───
  PT_NAME: '[data-test-id="file:user-profile-title-name"]',
  PT_COUNTRY: '[data-test-id="about country"]',
  PT_BIRTHDAY: '[data-test-id="about birthday"]',
  PT_MARITAL: '[data-test-id="about maritalStatus"]',
  PT_HOBBIES: '[data-test-id="op-about__block-hobbies"]',
  PT_LOOKING_FOR: '[data-test-id="op-about__block-looking-for"]',
  PT_ABOUT_ME: '[data-test-id="op-about__block-about-me"]',
  PT_CITY: '[data-test-id="about city"], [data-test-id="about location"]',
  PT_WORK: '[data-test-id="about work"], [data-test-id="about occupation"], [data-test-id="about profession"]',
  PT_EDUCATION: '[data-test-id="about education"]',
  PT_LANGUAGES: '[data-test-id="about languages"]',
  PT_BODY_TYPE: '[data-test-id="about bodyType"], [data-test-id="about body-type"]',
  PT_SMOKING: '[data-test-id="about smoking"]',
  PT_DRINKING: '[data-test-id="about drinking"]',
  PT_CHILDREN: '[data-test-id="about children"]',
  PT_RELIGION: '[data-test-id="about religion"]',
  PT_ETHNICITY: '[data-test-id="about ethnicity"]',
  PT_HEIGHT: '[data-test-id="about height"]',
  PT_MOVIE_GENRES: '[data-test-id="op-about__block-movieGenres"], [data-test-id="op-about__block-movie-genres"]',
  PT_MUSIC_GENRES: '[data-test-id="op-about__block-musicGenres"], [data-test-id="op-about__block-music-genres"]',
  PT_GOAL: '[data-test-id="op-about__block-goal"]',
  TAG_LABEL: '.tag-label',

  // ─── FALLBACK NAME ───
  FALLBACK_NAME: '[class*="username"], [class*="display-name"], [class*="profile-name"], h1, h2',
  META_TITLE: 'meta[property="og:title"], meta[name="twitter:title"], meta[name="title"]',
  PAGE_TITLE: 'title',

  // ─── LIKE / FOLLOW / PHOTO ───
  PHOTO_VIEWER: '.photo-viewer, [data-test-id*="photo-view"], [role="dialog"], button[aria-label="Close"], [class*="gallery"], .modal-overlay',
  PERSON_CARD: 'img.person-card__photo, img.photo-card, .person-card, [data-test-id*="person-card"]',
  PHOTO_IMAGE: '[data-test-id="file:media click:photo-view"], [data-test-id*="photo-view"], .profile-photo-wrap img, [class*="profile"] img[src*="photo"]',
  LIKE_BTN: 'button[data-test-id*="set-like"], button.gallery-footer__like_narrow, button[data-test-id*="on-like"], button[aria-label*="Like"], button[class*="like"]:has(svg), button[class*="gallery"] button:has(svg[id*="Heart"]), .gallery-footer button:has(svg), button:has(svg[id*="Heart"])',
  NEXT_PHOTO_BTN: 'button[aria-label*="Next"], button[aria-label*="next"], button[aria-label*="Siguiente"], button[data-test-id*="next"]',
  CLOSE_BTN: 'button[aria-label="Close"], [aria-label*="close"]',
  LIKE_FOLLOW_BTN: 'button[data-test-id*="on-like"], button[data-test-id*="on-follow"]',
  FOLLOW_BTN: 'button[data-test-id*="on-follow"]',
  NEXT_PAGE_BTN: '[data-test-id="cmp:ui-button click:change-page-n ',
  NEXT_PAGE_CHEVRON: 'button:has(svg[data-icon="chevron-right"])',
  NEXT_PAGE_BTNS: '[data-test-id*="change-page-n"]',
  CARD_HEART: 'button[data-test-id*="like-profile"]',

  // ─── PINNED / SAVED DETECTION ───
  PINNED_INDICATORS: '[class*="pin"], [class*="saved"], [class*="star"], [class*="fixed"], [src*="pin"], [src*="star"], [data-pin], [data-saved]',
  PINNED_INDICATORS_LIGHT: '[class*="pin"], [class*="saved"], [class*="star"], [class*="fixed"]',
  PINNED_BOOKMARK: '[class*="pin"], [class*="saved"], [class*="bookmark"], [class*="starred"]',

  // ─── MAIL HISTORY (incoming/outgoing letters) ───
  MAIL_HISTORY_CONTAINER: '.mail-history, [class*="mail-history"], [class*="thread-view"], [class*="mail-thread"]',
  MAIL_HISTORY_ITEM: '[data-test-id*="mail-history-item"]',
  MAIL_HEADER: '.mail-header',
  MAIL_HEADER_NAME: '.name',
  MAIL_HEADER_NAME_FALLBACK: '.info-name-wrapper .name, .info .name, [class*="name"]:not([class*="wrapper"]):not([class*="row"]):not([class*="icon"]):not([class*="badge"]):not([class*="forbidden"]):not([class*="avatar"]):not([class*="tooltip"])',
  MAIL_HEADER_DATE: '.attachments .date, .date',
  MAIL_ITEM_SENT_STATUS: '[data-test-id="status-seen"]',
  MAIL_ITEM_IS_EXPANDED: '.mail-header[data-isexpanded="true"]',
  MAIL_BODY_AREA: '.mail-body, [class*="mail-body"], [class*="letter-text"], [class*="letter-body"], [class*="message-content"]',
  MAIL_OPERATOR_NAME: 'Me',
  MAIL_INBOX_ITEM: '[data-test-id*="mail-box-item"]',
  MAIL_OPEN_THREAD: '[data-test-id*="open-thread"]',

  // ─── TIME / DATE ───
  TIME_ELEMENT: '[class*="time"], [class*="date"], [class*="updated"], [class*="duration"], [class*="timestamp"], small, time',

  // ─── ACTIVE / LIMIT SECTIONS ───
  ACTIVE_SECTION: '[class*="active"], [id*="active"]',
  ACTIVE_LIMIT_CONTACTS: '[class*="contact"] a[href*="/profile"], [class*="limit"] a[href], [class*="active"] a[href*="/profile"]',
  MAIL_BOX_ITEM: '[data-test-id="mail-box-item-root"], .mail-box-item',
  MAIL_BOX_OPEN_THREAD: '[data-test-id="file:mail-box-item click:open-thread"]',

  // ─── CHAT MESSAGE ───
  MESSAGE_NAME: '[class*="name"], [class*="sender"], [class*="author"]',
  MESSAGE_CONTENT: '.content, [class*="content"], p',

  // ─── SYSTEM MESSAGE ───
  SYSTEM_MSG: '[data-test-id*="system-msg"]',
  SYSTEM_MSG_TEXT: 'We believe people come here',

  // ─── LANGUAGE SELECT ───
  LANGUAGE_SELECT: 'select[class*="lang"], select[id*="lang"], select[class*="language"], select[name*="lang"]',

  // ─── SEARCH / BROWSE BUTTONS ───
  ACTION_BTN_WILDCARD: 'button, a, [role="button"], span[class*="btn"]',

  // ─── EMAIL CONTACT LINK ───
  PROFILE_LINK_BY_ID: function(id) { return 'a[href*="/profile/' + id + '"], a[href*="/' + id + '"], a[href*="' + id + '"]'; },
  DATA_ID_SELECTOR: function(id) { return '[data-id="' + id + '"], [data-user-id="' + id + '"], [data-contact-id="' + id + '"]'; },
};
