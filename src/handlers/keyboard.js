const STARS_PACKAGES = [
  { stars: 50, price: 10000 },
  { stars: 100, price: 19500 },
  { stars: 150, price: 29000 },
  { stars: 200, price: 39000 },
  { stars: 250, price: 50000 },
  { stars: 300, price: 69000 },
];

function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💰 Balansim", callback_data: "balance" },
          { text: "✨ Stars ishlash", callback_data: "invite" },
        ],
        [
          { text: "👤 Profilim", callback_data: "myProfile" },
          { text: "🏆 Top referallar", callback_data: "topReferrals" },
        ],
        [{ text: "🎁 Yechib olish", callback_data: "withdraw" }],
        [{ text: "⭐ Stars sotib olish", callback_data: "buyStars" }],
      ],
    },
  };
}

function backMenu() {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Orqaga", callback_data: "exit" }]],
    },
  };
}

function giftMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "15 ⭐ (🐻)", callback_data: "gift_15_bear" },
          { text: "15 ⭐ (💖)", callback_data: "gift_15_heart" },
        ],
        [
          { text: "25 ⭐ (🌹)", callback_data: "gift_25_rose" },
          { text: "25 ⭐ (🎁)", callback_data: "gift_25_box" },
        ],
        [
          { text: " 50 ⭐ (🍾)", callback_data: "gift_50_champ" },
          { text: " 50 ⭐ (💐)", callback_data: "gift_50_flowers" },
        ],
        [
          { text: " 50 ⭐ (🎄)", callback_data: "gift_50_tree" },
          { text: " 50 ⭐ (🎂)", callback_data: "gift_50_cake" },
        ],
        [
          { text: " 100 ⭐ (🏆)", callback_data: "gift_100_cup" },
          { text: " 100 ⭐ (💍)", callback_data: "gift_100_ring" },
        ],
        [{ text: " 100 ⭐ (💎)", callback_data: "gift_100_diamond" }],
        [{ text: "⬅️ Orqaga", callback_data: "exit" }],
      ],
    },
  };
}

function adminKeyboard({ isSuperAdmin }) {
  const keyboard = [
    [{ text: "📊 Statistika" }, { text: "📣 Xabar yuborish" }],
    [{ text: "➕ Kanal qo'shish" }, { text: "➖ Kanal uzish" }],
    [{ text: "💫 Stars narxini o'zgartirish" }, { text: "🤖 Bot" }],
    [{ text: "⭐ Pro sotib olish" }],
  ];

  if (isSuperAdmin) {
    keyboard.push([
      { text: "🤖 Botlar boshqaruvi" },
      { text: "📡 Barcha botlarga xabar" },
    ]);
  }

  return {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
    },
  };
}

function removeChannelButtons(channels) {
  return {
    reply_markup: {
      inline_keyboard: channels.map((channel) => [
        {
          text: `🗑 ${channel.kanalNomi}`,
          callback_data: `remove_channel_${channel._id}`,
        },
      ]),
    },
  };
}

function managedBotsButtons(bots, action) {
  return {
    reply_markup: {
      inline_keyboard: bots.map((item) => [
        {
          text: `🤖 @${item.username} • ${item.title || "bot"}`,
          callback_data: `${action}_${item._id}`,
        },
      ]),
    },
  };
}

function managementActions(botId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "➕ Kanal qo'shish",
            callback_data: `manage_add_channel_${botId}`,
          },
        ],
        [
          {
            text: "➖ Kanal uzish",
            callback_data: `manage_remove_channel_${botId}`,
          },
        ],
        [
          {
            text: "📣 Xabar yuborish",
            callback_data: `manage_broadcast_${botId}`,
          },
        ],
        [
          {
            text: "💫 Stars narxini o'zgartirish",
            callback_data: `manage_price_${botId}`,
          },
        ],
      ],
    },
  };
}

function proPurchaseButtons(botId, isActive) {
  return {
    reply_markup: {
      inline_keyboard: [
        isActive
          ? [{ text: "✨ Pro faol", callback_data: `show_pro_${botId}` }]
          : [{ text: "⭐ Pro sotib olish", callback_data: `buy_pro_${botId}` }],
        [{ text: "📋 Pro haqida", callback_data: `show_pro_${botId}` }],
      ],
    },
  };
}

function starsPackageMenu(prefix) {
  return {
    reply_markup: {
      inline_keyboard: [
        ...STARS_PACKAGES.map((item) => [
          {
            text: `⭐ ${item.stars} - ${item.price.toLocaleString("uz-UZ")} so'm`,
            callback_data: `${prefix}_${item.stars}`,
          },
        ]),
        [{ text: "❌ Bekor qilish", callback_data: "cancel_buy_stars" }],
      ],
    },
  };
}

function buyStarsTargetMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🙋 O'zim uchun", callback_data: "buyStars_self" }],
        [{ text: "🎁 Boshqa odamga", callback_data: "buyStars_other" }],
        [{ text: "❌ Bekor qilish", callback_data: "cancel_buy_stars" }],
      ],
    },
  };
}

function insufficientBalanceButtons(starsAmount) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "💳 Balansni to'ldirish",
            callback_data: `topup_start_${starsAmount}`,
          },
        ],
        [{ text: "✍️ Boshqa miqdor (So'm)", callback_data: "topup_custom" }],
        [{ text: "❌ Bekor qilish", callback_data: "cancel_buy_stars" }],
      ],
    },
  };
}

function paymentActionButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ To'lov qildim", callback_data: "topup_submit" }],
        [{ text: "❌ Bekor qilish", callback_data: "cancel_topup" }],
      ],
    },
  };
}

module.exports = {
  STARS_PACKAGES,
  adminKeyboard,
  backMenu,
  buyStarsTargetMenu,
  giftMenu,
  insufficientBalanceButtons,
  mainMenu,
  managedBotsButtons,
  managementActions,
  paymentActionButtons,
  proPurchaseButtons,
  removeChannelButtons,
  starsPackageMenu,
};
