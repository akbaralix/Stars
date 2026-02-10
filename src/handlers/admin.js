const User = require("../../beckend/User");
const Kanal = require("../../beckend/Kanal");
const Order = require("../../beckend/Order");
const callback = require("../callback/callback");
const adminState = {};
const ADMIN_ID = process.env.ADMIN_ID;

module.exports = async (bot) => {
  // Xabarni hammaga tarqatish funksiyasi
  const sendBroadcast = async (adminId) => {
    const state = adminState[adminId];
    if (!state) return;

    const allUsers = await User.find({});
    let count = 0;

    await bot.sendMessage(adminId, "🚀 Tarqatish boshlandi...");

    for (const user of allUsers) {
      try {
        await bot.copyMessage(user.telegramId, adminId, state.messageId, {
          reply_markup: state.keyboard || {},
        });
        count++;
      } catch (err) {
        console.log(`${user.telegramId} ga yuborilmadi: ${err.message}`);
      }
    }

    await bot.sendMessage(
      adminId,
      `✅ Yakunlandi: ${count} ta foydalanuvchiga yetkazildi.`,
    );
    delete adminState[adminId];
  };

  bot.on("message", async (msg) => {
    const chatID = msg.chat.id;
    const text = msg.text;

    if (!ADMIN_ID.includes(chatID)) return;

    // --- STATISTIKA ---
    if (text === "📊 Statistika") {
      const uCount = await User.countDocuments();
      const oCount = await Order.countDocuments();
      const kCount = await Kanal.countDocuments();

      return bot.sendMessage(
        chatID,
        `📊 *AkaStarsBot Statistikasi*\n\n` +
          `👥 Foydalanuvchilar: *${uCount}*\n` +
          `📂 Buyurtmalar: *${oCount}*\n` +
          `📢 Kanallar: *${kCount}*\n\n` +
          `✨ Botning faoliyati va foydalanuvchi o‘sishini kuzatib boring!`,
        { parse_mode: "Markdown" },
      );
    }

    // --- XABAR YUBORISH (ADS) ---
    if (text === "📤 Xabar yuborish") {
      adminState[chatID] = { step: "waiting_for_content" };
      return bot.sendMessage(
        chatID,

        "✍️ *Diqqat!* \n\n" +
          "Endi barcha foydalanuvchilarga yuboriladigan xabarni yozing. 📩\n" +
          "Siz matn, rasm, video yoki boshqa fayllarni yuborishingiz mumkin.",
        { parse_mode: "Markdown" },
      );
    }

    if (adminState[chatID]?.step === "waiting_for_content") {
      adminState[chatID].messageId = msg.message_id;
      adminState[chatID].step = "waiting_for_button_choice";

      return bot.sendMessage(chatID, "🔗 Xabarga linkli tugma qo'shilsinmi?", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Ha", callback_data: "add_button" },
              { text: "❌ Yo'q", callback_data: "no_button" },
            ],
          ],
        },
      });
    }

    if (adminState[chatID]?.step === "waiting_for_link") {
      if (!text || !text.includes("-")) {
        return bot.sendMessage(
          chatID,
          "⚠️ Noto'g'ri format. Namuna: \n`Kanalga o'tish - https://t.me/kanal`",
          { parse_mode: "Markdown" },
        );
      }
      const [btnText, ...linkParts] = text.split("-");
      const btnLink = linkParts.join("-").trim();
      adminState[chatID].keyboard = {
        inline_keyboard: [[{ text: btnText.trim(), url: btnLink }]],
      };
      return await sendBroadcast(chatID);
    }

    // --- KANAL QO'SHISH ---
    if (text === "➕ Kanal qo'shish") {
      // SHU YERDA HOLATNI BELGILASH KERAK:
      adminState[chatID] = { step: "waiting_for_channel_user" };
      return bot.sendMessage(
        chatID,
        "*Ulamoqchi bo'lgan kanal userini kiriting (@kanal_nomi):*\n\n_ESLATMA: botni kanalga admin qiling!_",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Bekor qilish", callback_data: "cancel_action" }],
            ],
          },
        },
      );
    }

    if (text === "➖ Kanal uzish") {
      const allChannels = await Kanal.find({});
      if (allChannels.length === 0) {
        return bot.sendMessage(chatID, "Ulangan kanallar yo'q!");
      }

      // Har kanal uchun bitta tugma, har biri alohida qator
      const buttons = allChannels.map((kanal) => [
        {
          text: kanal.kanalNomi,
          callback_data: `remove_kanal_${kanal.kanalId}`,
        },
      ]);

      await bot.sendMessage(
        chatID,
        "📢 *O'chirmoqchi bo'lgan kanalingizni tanlang:* \n\n" +
          "Quyidagi ro'yxatdan kanalni tanlab, uni o‘chirishingiz mumkin. ❌",
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: buttons },
        },
      );

      // Stepni belgilash
      adminState[chatID] = { step: "waiting_for_channel_removal" };
    }

    // Callback query orqali kanal o‘chirish
    bot.on("callback_query", async (query) => {
      const chatID = query.message.chat.id;
      const data = query.data;

      // Agar admin kanal o‘chirish holatida bo‘lsa
      if (adminState[chatID]?.step === "waiting_for_channel_removal") {
        if (data.startsWith("remove_kanal_")) {
          const kanalId = data.replace("remove_kanal_", "");
          const channel = await Kanal.findOne({ kanalId });

          if (!channel) {
            await bot.answerCallbackQuery(query.id, {
              text: "❌ Kanal topilmadi",
            });
            return;
          }

          await channel.deleteOne();
          await bot.answerCallbackQuery(query.id, {
            text: `✅ Kanal ${channel.kanalNomi} o‘chirildi`,
          });

          // Xabarni yangilash / tugmalarni olib tashlash
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatID, message_id: query.message.message_id },
          );

          delete adminState[chatID];
        }
      }
    });

    if (adminState[chatID]?.step === "waiting_for_channel_user") {
      const channelUsername = text.startsWith("@") ? text : `@${text}`;
      try {
        const chatMember = await bot.getChatMember(
          channelUsername,
          (await bot.getMe()).id,
        );
        if (chatMember.status !== "administrator") {
          return bot.sendMessage(chatID, "❌ Men bu kanalda admin emasman!");
        }

        const chatInfo = await bot.getChat(channelUsername);
        const exists = await Kanal.findOne({ kanalId: chatInfo.id });
        if (exists) {
          delete adminState[chatID];
          return bot.sendMessage(chatID, "⚠️ Bu kanal allaqachon mavjud.");
        }

        const newKanal = new Kanal({
          kanalNomi: chatInfo.title,
          kanalURL: channelUsername,
          kanalId: chatInfo.id,
        });

        await newKanal.save();
        delete adminState[chatID];
        return bot.sendMessage(
          chatID,
          `🎉 *Kanal muvaffaqiyatli qo‘shildi!* 🎉\n\n` +
            `📌 Kanal nomi: **${chatInfo.title}**\n` +
            `✅ Endi bu kanal bot bilan ishlashga tayyor.`,
          { parse_mode: "Markdown" },
        );
      } catch (error) {
        return bot.sendMessage(
          chatID,
          "❌ Kanal topilmadi yoki bot admin emas.",
        );
      }
    }
  });

  bot.on("callback_query", async (query) => {
    const chatID = query.message.chat.id;
    const data = query.data;
    if (!adminState[chatID]) return bot.answerCallbackQuery(query.id);

    // ... callback_query ichida
    if (data === "cancel_action") {
      delete adminState[chatID]; // Holatni tozalaymiz
      await bot.deleteMessage(chatID, query.message.message_id).catch(() => {});
      return bot.sendMessage(
        chatID,
        "❌ Amallar bekor qilindi va asosiy menyuga qaytdingiz.",
      );
    }

    if (data === "add_button") {
      await bot.deleteMessage(chatID, query.message.message_id).catch(() => {});
      adminState[chatID].step = "waiting_for_link";
      bot.sendMessage(
        chatID,
        "🔗 Tugma nomi va linkni yuboring:\n`Tugma - https://link.com`",
        { parse_mode: "Markdown" },
      );
    }

    if (data === "no_button") {
      await bot.deleteMessage(chatID, query.message.message_id).catch(() => {});
      await sendBroadcast(chatID);
    }
    bot.answerCallbackQuery(query.id);
  });
};
