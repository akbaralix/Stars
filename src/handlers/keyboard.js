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
          { text: "🐻 15 ⭐", callback_data: "gift_15_bear" },
          { text: "💖 15 ⭐", callback_data: "gift_15_heart" },
        ],
        [
          { text: "🌹 25 ⭐", callback_data: "gift_25_rose" },
          { text: "🎁 25 ⭐", callback_data: "gift_25_box" },
        ],
        [
          { text: "🍾 50 ⭐", callback_data: "gift_50_champ" },
          { text: "💐 50 ⭐", callback_data: "gift_50_flowers" },
        ],
        [
          { text: "🎄 50 ⭐", callback_data: "gift_50_tree" },
          { text: "🎂 50 ⭐", callback_data: "gift_50_cake" },
        ],
        [
          { text: "🏆 100 ⭐", callback_data: "gift_100_cup" },
          { text: "💍 100 ⭐", callback_data: "gift_100_ring" },
        ],
        [{ text: "💎 100 ⭐", callback_data: "gift_100_diamond" }],
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

module.exports = {
  adminKeyboard,
  backMenu,
  giftMenu,
  mainMenu,
  managedBotsButtons,
  managementActions,
  proPurchaseButtons,
  removeChannelButtons,
};
