module.exports = {
  mainMenyu: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🌟 Balans", callback_data: "balance" },
          { text: "⭐ Yulduz ishlash", callback_data: "invite" },
        ],
        [
          { text: "👤 Profilim", callback_data: "myProfile" },
          { text: "🏆 Top referallar", callback_data: "topReferrals" },
        ],
        [{ text: "📤 Yechib olish", callback_data: "withdraw" }],
      ],
    },
  },
  mnyu: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🌟 Balans", callback_data: "balance" },
          { text: "⭐ Yulduz ishlash", callback_data: "invite" },
        ],
        [
          { text: "👤 Profilim", callback_data: "myProfile" },
          { text: "🏆 Top referallar", callback_data: "topReferrals" },
        ],
        [{ text: "📤 Yechib olish", callback_data: "withdraw" }],
      ],
    },
  },
  ortga: {
    reply_markup: {
      inline_keyboard: [[{ text: "⬅️ Orqaga", callback_data: "exit" }]],
    },
  },
  sovgalarRoyihati: {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "15 ⭐ (🐻)", callback_data: "gift_15_bear" },
          { text: "15 ⭐ (💝)", callback_data: "gift_15_heart" },
        ],
        [
          { text: "25 ⭐ (🌹)", callback_data: "gift_25_rose" },
          { text: "25 ⭐ (🎁)", callback_data: "gift_25_box" },
        ],
        [
          { text: "50 ⭐ (🍾)", callback_data: "gift_50_champ" },
          { text: "50 ⭐ (💐)", callback_data: "gift_50_flowers" },
        ],
        [
          { text: "50 ⭐ (🎄)", callback_data: "gift_50_tree" },
          { text: "50 ⭐ (🎂)", callback_data: "gift_50_cake" },
        ],
        [
          { text: "100 ⭐ (🏆)", callback_data: "gift_100_cup" },
          { text: "100 ⭐ (💍)", callback_data: "gift_100_ring" },
        ],
        [{ text: "100 ⭐ (💎)", callback_data: "gift_100_diamond" }],
        [{ text: "⬅️ Orqaga", callback_data: "exit" }],
      ],
    },
  },
  adminKeyboard: {
    reply_markup: {
      keyboard: [
        [{ text: "📊 Statistika" }, { text: "📤 Xabar yuborish" }],
        [{ text: "➕ Kanal qo'shish" }, { text: "➖ Kanal uzish" }],
      ],
      resize_keyboard: true,
    },
  },
};
