const mongoose = require("mongoose");
const BotModel = require("../../beckend/Bot");
const { getUserModel } = require("../../beckend/User");
const Kanal = require("../../beckend/Kanal");
const Order = require("../../beckend/Order");
const kb = require("./keyboard");
const {
  getSession,
  setSession,
  clearSession,
} = require("../runtime/sessionStore");

module.exports = (bot, context, botManager) => {
  const PRO_CHANNEL_LIMIT = 2;
  const PRO_PRICE_STARS = 50;
  const PRO_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  function isOwner(userId) {
    return Number(userId) === Number(context.ownerId);
  }

  function isProActive(botDoc) {
    return Boolean(
      botDoc?.proExpiresAt &&
      new Date(botDoc.proExpiresAt).getTime() > Date.now(),
    );
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString("uz-UZ");
  }

  async function sendOptionalSticker(chatId, envKey) {
    const stickerId = process.env[envKey];
    if (!stickerId) return;
    await bot.sendSticker(chatId, stickerId).catch(() => {});
  }

  async function getManagedBot(botId) {
    return BotModel.findById(botId);
  }

  async function showProOffer(chatId, targetBotId) {
    const targetBot = await getManagedBot(targetBotId);
    if (!targetBot) {
      await bot.sendMessage(chatId, "Bot topilmadi.");
      return;
    }

    if (targetBot.isPrimary) {
      await bot.sendMessage(
        chatId,
        `👑 <b>Asosiy bot uchun Pro talab qilinmaydi.</b>\n\nBu bot tizimning bosh botidir va kanal/guruh limiti unga qo'llanmaydi.`,
        { parse_mode: "HTML" },
      );
      return;
    }

    const active = isProActive(targetBot);
    await sendOptionalSticker(
      chatId,
      active ? "PRO_ACTIVE_STICKER_ID" : "PRO_OFFER_STICKER_ID",
    );

    const text = active
      ? `✨ <b>Pro obuna faol</b>\n\n🤖 Bot: @${targetBot.username}\n📅 Amal qilish muddati: <b>${formatDate(targetBot.proExpiresAt)}</b>\n\nPro bilan siz 2 tadan ko'p kanal va guruh ulashingiz mumkin.`
      : `⭐ <b>Pro obuna kerak</b>\n\n🤖 Bot: @${targetBot.username}\n🔒 Oddiy rejimda faqat <b>${PRO_CHANNEL_LIMIT} ta</b> kanal yoki guruh ulash mumkin.\n\n✨ <b>Pro afzalliklari:</b>\n• 2 tadan ortiq kanal/guruh ulash\n• Kengroq boshqaruv imkoniyati\n• Faqat <b>${PRO_PRICE_STARS} Stars</b> / 1 oy\n\nPastdagi tugma orqali Pro sotib oling.`;

    await bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      ...kb.proPurchaseButtons(targetBotId, active),
    });
  }

  async function enforceProLimit(chatId, targetBotId) {
    const targetBot = await getManagedBot(targetBotId);
    if (!targetBot || targetBot.isPrimary) {
      return false;
    }

    const currentCount = await Kanal.countDocuments({ botId: targetBotId });
    if (currentCount < PRO_CHANNEL_LIMIT || isProActive(targetBot)) {
      return false;
    }

    await showProOffer(chatId, targetBotId);
    return true;
  }

  async function sendProInvoice(chatId, targetBotId) {
    const targetBot = await getManagedBot(targetBotId);
    if (!targetBot) {
      await bot.sendMessage(chatId, "Bot topilmadi.");
      return;
    }

    await sendOptionalSticker(chatId, "PRO_OFFER_STICKER_ID");
    await bot.sendInvoice(
      chatId,
      "Pro obuna",
      "1 oylik Pro obunani 50 ⭐ Stars evaziga sotib oling va cheksiz imkoniyatlardan foydalaning 🚀",
      `pro:${targetBotId}:${Date.now()}`,
      "",
      "XTR",
      [{ label: "Pro 1 oy", amount: PRO_PRICE_STARS }],
      {
        start_parameter: `pro_${targetBotId}`,
      },
    );
  }

  async function sendBotBroadcast(
    targetBotId,
    adminId,
    sourceMessageId,
    keyboard,
  ) {
    const runtime = botManager.getRuntime(targetBotId);
    if (!runtime) {
      await bot.sendMessage(adminId, "Tanlangan bot ishlamayapti.");
      return;
    }

    const TargetUser = getUserModel(targetBotId);
    const targetUsers = await TargetUser.find({});
    let successCount = 0;

    for (const user of targetUsers) {
      try {
        await runtime.bot.copyMessage(
          user.telegramId,
          adminId,
          sourceMessageId,
          {
            reply_markup: keyboard || undefined,
          },
        );
        successCount += 1;

        // Telegram rate limit uchun qisqa pauza
        if (successCount % 20 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.log(`Broadcast yuborilmadi ${user.telegramId}:`, error.message);
      }
    }

    await bot.sendMessage(
      adminId,
      `Yuborish yakunlandi: ${successCount} ta foydalanuvchi.`,
    );
  }

  async function sendNetworkBroadcast(adminId, sourceMessageId, keyboard) {
    let total = 0;

    for (const runtime of botManager.getAllRuntimes()) {
      const TargetUser = getUserModel(String(runtime.botDoc._id));
      const targetUsers = await TargetUser.find({});
      for (const user of targetUsers) {
        try {
          await runtime.bot.copyMessage(
            user.telegramId,
            adminId,
            sourceMessageId,
            {
              reply_markup: keyboard || undefined,
            },
          );
          total += 1;
        } catch (error) {
          console.log(
            `Tarmoq broadcast yuborilmadi ${user.telegramId}:`,
            error.message,
          );
        }
      }
    }

    await bot.sendMessage(
      adminId,
      `Barcha botlarga yuborish tugadi: ${total} ta jo'natma.`,
    );
  }

  async function promptForChannel(chatId, botId) {
    setSession(context.botId, chatId, {
      step: "waiting_for_channel_user",
      targetBotId: botId,
    });
    await bot.sendMessage(
      chatId,
      "Ulamoqchi bo'lgan kanal userini yuboring (@kanal_nomi). Bot o'sha kanalda admin bo'lishi kerak.",
    );
  }

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const User = getUserModel(context.botId);

    if (!text || !isOwner(msg.from.id)) {
      return;
    }

    const session = getSession(context.botId, chatId);

    if (text === "📊 Statistika") {
      const userCount = await User.countDocuments({});
      const orderCount = await Order.countDocuments({ botId: context.botId });
      const channelCount = await Kanal.countDocuments({ botId: context.botId });
      const managedBotCount = context.isPrimary
        ? await BotModel.countDocuments({ isPrimary: false })
        : await BotModel.countDocuments({
            ownerId: context.ownerId,
            isPrimary: false,
          });

      await bot.sendMessage(
        chatId,
        `📊 <b>${context.username}</b> statistikasi

👥 Foydalanuvchilar: <b>${userCount}</b>
🧾 Buyurtmalar: <b>${orderCount}</b>
📢 Kanallar: <b>${channelCount}</b>
🤖 Qo'shilgan botlar: <b>${managedBotCount}</b>`,
        { parse_mode: "HTML" },
      );
      return;
    }

    if (text === "📣 Xabar yuborish") {
      setSession(context.botId, chatId, {
        step: "waiting_for_broadcast_content",
        targetBotId: context.botId,
      });
      await bot.sendMessage(
        chatId,
        "📨 Yubormoqchi bo'lgan xabaringizni yuboring.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Bekor qilish", callback_data: "cancel_broadcast" }],
            ],
          },
        },
      );
      return;
    }

    if (text === "📡 Barcha botlarga xabar" && context.isPrimary) {
      setSession(context.botId, chatId, {
        step: "waiting_for_network_broadcast_content",
      });
      await bot.sendMessage(
        chatId,
        "🌐 Barcha botlar foydalanuvchilariga yuboriladigan xabarni yuboring.",
      );
      return;
    }

    if (text === "➕ Kanal qo'shish") {
      if (await enforceProLimit(chatId, context.botId)) {
        return;
      }

      await promptForChannel(chatId, context.botId);
      return;
    }

    if (text === "➖ Kanal uzish") {
      const channels = await Kanal.find({ botId: context.botId });
      if (channels.length === 0) {
        await bot.sendMessage(chatId, "📭 Bu botga hali kanal ulanmagan.");
        return;
      }

      await bot.sendMessage(
        chatId,
        "🗂 Uzmoqchi bo'lgan kanalni tanlang.",
        kb.removeChannelButtons(channels),
      );
      return;
    }

    if (text === "💫 Stars narxini o'zgartirish") {
      setSession(context.botId, chatId, {
        step: "waiting_for_stars_price",
        targetBotId: context.botId,
      });

      await bot.sendMessage(
        chatId,
        "💸 Yangi Stars narxini raqam ko'rinishida yuboring.\n\n<i>Har bir referral orqali taklif qilingan foydalanuvchi uchun siz belgilagan narx amal qiladi‼️</i>",
        {
          parse_mode: "HTML",
        },
      );
      return;
    }
    if (text === "🤖 Bot") {
      await bot.sendMessage(
        chatId,
        "✨ <b>Bot boshqaruv markazi</b>\n\nQuyidagi bo'limlardan birini tanlang va ishlashni davom ettiring.",
        { parse_mode: "HTML", ...kb.mainMenu() },
      );
    }

    if (text === "⭐ Pro sotib olish") {
      await showProOffer(chatId, context.botId);
      return;
    }

    if (text === "🤖 Botlar boshqaruvi" && context.isPrimary) {
      const bots = await BotModel.find({ isPrimary: false }).sort({
        createdAt: -1,
      });
      if (bots.length === 0) {
        await bot.sendMessage(chatId, "🤖 Hali qo'shimcha botlar ulanmagan.");
        return;
      }

      await bot.sendMessage(
        chatId,
        "🛠 Boshqarmoqchi bo'lgan botni tanlang.",
        kb.managedBotsButtons(bots, "manage_bot"),
      );
      return;
    }

    if (session?.step === "waiting_for_broadcast_content") {
      setSession(context.botId, chatId, {
        step: "waiting_for_broadcast_button_choice",
        targetBotId: session.targetBotId,
        messageId: msg.message_id,
      });
      await bot.sendMessage(chatId, "🔘 Xabarga tugma ham qo'shilsinmi?", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Ha", callback_data: "broadcast_add_button" },
              { text: "❌ Yo'q", callback_data: "broadcast_no_button" },
            ],
          ],
        },
      });
      return;
    }

    if (session?.step === "waiting_for_network_broadcast_content") {
      setSession(context.botId, chatId, {
        step: "waiting_for_network_broadcast_button_choice",
        messageId: msg.message_id,
      });
      await bot.sendMessage(chatId, "🔘 Xabarga tugma ham qo'shilsinmi?", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Ha", callback_data: "network_add_button" },
              { text: "❌ Yo'q", callback_data: "network_no_button" },
            ],
          ],
        },
      });
      return;
    }

    if (session?.step === "waiting_for_broadcast_link") {
      if (!text.includes("-")) {
        await bot.sendMessage(
          chatId,
          "⚠️ Format shunday bo'lsin:\nTugma nomi - https://link",
        );
        return;
      }

      const [buttonText, ...linkParts] = text.split("-");
      await sendBotBroadcast(session.targetBotId, chatId, session.messageId, {
        inline_keyboard: [
          [{ text: buttonText.trim(), url: linkParts.join("-").trim() }],
        ],
      });
      clearSession(context.botId, chatId);
      return;
    }

    if (session?.step === "waiting_for_network_broadcast_link") {
      if (!text.includes("-")) {
        await bot.sendMessage(
          chatId,
          "⚠️ Format shunday bo'lsin:\nTugma nomi - https://link",
        );
        return;
      }

      const [buttonText, ...linkParts] = text.split("-");
      await sendNetworkBroadcast(chatId, session.messageId, {
        inline_keyboard: [
          [{ text: buttonText.trim(), url: linkParts.join("-").trim() }],
        ],
      });
      clearSession(context.botId, chatId);
      return;
    }

    if (session?.step === "waiting_for_channel_user") {
      const runtime = botManager.getRuntime(session.targetBotId);
      if (!runtime) {
        clearSession(context.botId, chatId);
        await bot.sendMessage(chatId, "⚠️ Tanlangan bot hozir ishlamayapti.");
        return;
      }

      const channelUsername = text.startsWith("@") ? text : `@${text}`;
      try {
        const me = await runtime.bot.getMe();
        const member = await runtime.bot.getChatMember(channelUsername, me.id);
        if (member.status !== "administrator") {
          await bot.sendMessage(chatId, "⚠️ Bot bu kanalda admin emas.");
          return;
        }

        const chatInfo = await runtime.bot.getChat(channelUsername);
        const exists = await Kanal.findOne({
          botId: session.targetBotId,
          kanalId: String(chatInfo.id),
        });

        if (exists) {
          clearSession(context.botId, chatId);
          await bot.sendMessage(chatId, "ℹ️ Bu kanal allaqachon ulangan.");
          return;
        }

        await Kanal.create({
          botId: session.targetBotId,
          ownerId: runtime.botDoc.ownerId,
          kanalNomi: chatInfo.title,
          kanalURL: channelUsername,
          kanalId: String(chatInfo.id),
        });

        clearSession(context.botId, chatId);
        await bot.sendMessage(
          chatId,
          `🎉 Kanal muvaffaqiyatli ulandi:\n${chatInfo.title}`,
        );
      } catch (error) {
        await bot.sendMessage(
          chatId,
          "❌ Kanal topilmadi yoki bot admin emas.",
        );
      }
      return;
    }

    if (session?.step === "waiting_for_stars_price") {
      const starsPrice = Number(text);
      if (Number.isNaN(starsPrice) || starsPrice < 0) {
        await bot.sendMessage(chatId, "⚠️ Faqat musbat raqam yuboring.");
        return;
      }

      await botManager.updateStarsPrice(session.targetBotId, starsPrice);
      clearSession(context.botId, chatId);
      await bot.sendMessage(
        chatId,
        `✅ Stars narxi muvaffaqiyatli yangilandi: ${starsPrice}`,
      );
    }
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const session = getSession(context.botId, chatId);

    if (!isOwner(query.from.id)) {
      return;
    }

    if (data.startsWith("remove_channel_")) {
      const channel = await Kanal.findById(data.replace("remove_channel_", ""));

      if (!channel) {
        return;
      }

      if (
        !context.isPrimary &&
        Number(channel.ownerId) !== Number(context.ownerId)
      ) {
        return;
      }

      await Kanal.deleteOne({ _id: channel._id });
      await bot.answerCallbackQuery(query.id, { text: "Kanal uzildi ✅" });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: query.message.message_id },
      );
      return;
    }

    if (
      data === "broadcast_add_button" &&
      session?.step === "waiting_for_broadcast_button_choice"
    ) {
      setSession(context.botId, chatId, {
        ...session,
        step: "waiting_for_broadcast_link",
      });
      await bot.sendMessage(
        chatId,
        "🔗 Quyidagicha yuboring:\nTugma nomi - https://link",
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (
      data === "broadcast_no_button" &&
      session?.step === "waiting_for_broadcast_button_choice"
    ) {
      await sendBotBroadcast(session.targetBotId, chatId, session.messageId);
      clearSession(context.botId, chatId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (
      data === "network_add_button" &&
      session?.step === "waiting_for_network_broadcast_button_choice"
    ) {
      setSession(context.botId, chatId, {
        ...session,
        step: "waiting_for_network_broadcast_link",
      });
      await bot.sendMessage(
        chatId,
        "🔗 Quyidagicha yuboring:\nTugma nomi - https://link",
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (
      data === "network_no_button" &&
      session?.step === "waiting_for_network_broadcast_button_choice"
    ) {
      await sendNetworkBroadcast(chatId, session.messageId);
      clearSession(context.botId, chatId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // --- MANAGE BOT SELECTION (CRASH FIXED HERE) ---
    if (data.startsWith("manage_bot_") && context.isPrimary) {
      const botId = data.replace("manage_bot_", "");

      let managedBot;
      if (mongoose.Types.ObjectId.isValid(botId)) {
        managedBot = await BotModel.findById(botId);
      } else {
        managedBot = await BotModel.findOne({ telegramId: Number(botId) });
      }

      if (!managedBot) {
        await bot.answerCallbackQuery(query.id, {
          text: "Bot topilmadi",
          show_alert: true,
        });
        return;
      }

      const ManagedUser = getUserModel(String(managedBot._id));
      const totalUsers = await ManagedUser.countDocuments({});

      // Egasining ismini chiroyli bosiladigan havola qilish:
      const creatorName = managedBot.ownerUsername
        ? `@${managedBot.ownerUsername}`
        : `Foydalanuvchi [ID: ${managedBot.ownerId}]`;

      await bot.sendMessage(
        chatId,
        `<b>🤖 Tanlangan bot: @${managedBot.username}</b>\n\n` +
          `Bot foydalanuvchilari soni: <b>${totalUsers}</b>\n` +
          `Bot yaratuvchisi: <a href="tg://user?id=${managedBot.ownerId}">${creatorName}</a>\n\n` +
          `Kerakli amalni tanlang.`,
        {
          parse_mode: "HTML",
          ...kb.managementActions(String(managedBot._id)),
        },
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith("manage_add_channel_") && context.isPrimary) {
      const targetBotId = data.replace("manage_add_channel_", "");
      if (await enforceProLimit(chatId, targetBotId)) {
        await bot.answerCallbackQuery(query.id);
        return;
      }

      await promptForChannel(chatId, targetBotId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith("manage_remove_channel_") && context.isPrimary) {
      const botId = data.replace("manage_remove_channel_", "");
      const channels = await Kanal.find({ botId });
      if (channels.length === 0) {
        await bot.answerCallbackQuery(query.id, {
          text: "Kanal yo'q",
          show_alert: true,
        });
        return;
      }

      await bot.sendMessage(
        chatId,
        "🗂 Uzmoqchi bo'lgan kanalni tanlang.",
        kb.removeChannelButtons(channels),
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith("manage_broadcast_") && context.isPrimary) {
      setSession(context.botId, chatId, {
        step: "waiting_for_broadcast_content",
        targetBotId: data.replace("manage_broadcast_", ""),
      });
      await bot.sendMessage(
        chatId,
        "📨 Tanlangan bot foydalanuvchilariga yuboriladigan xabarni yuboring.",
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith("manage_price_") && context.isPrimary) {
      setSession(context.botId, chatId, {
        step: "waiting_for_stars_price",
        targetBotId: data.replace("manage_price_", ""),
      });
      await bot.sendMessage(
        chatId,
        "💸 Tanlangan bot uchun yangi Stars narxini yuboring.",
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith("manage_pro_") && context.isPrimary) {
      await showProOffer(chatId, data.replace("manage_pro_", ""));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith("show_pro_")) {
      await showProOffer(chatId, data.replace("show_pro_", ""));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith("buy_pro_")) {
      const targetBotId = data.replace("buy_pro_", "");
      const targetBot = await getManagedBot(targetBotId);
      if (!targetBot) {
        await bot.answerCallbackQuery(query.id, {
          text: "Bot topilmadi",
          show_alert: true,
        });
        return;
      }

      if (
        !context.isPrimary &&
        String(targetBot._id) !== String(context.botId)
      ) {
        await bot.answerCallbackQuery(query.id, {
          text: "Ruxsat yo'q",
          show_alert: true,
        });
        return;
      }

      await sendProInvoice(chatId, targetBotId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    await bot.answerCallbackQuery(query.id).catch(() => {});
  });

  bot.on("pre_checkout_query", async (query) => {
    try {
      if (!query.invoice_payload?.startsWith("pro:")) {
        await bot.answerPreCheckoutQuery(query.id, true);
        return;
      }

      await bot.answerPreCheckoutQuery(query.id, true);
    } catch (error) {
      await bot
        .answerPreCheckoutQuery(query.id, false, {
          error_message: "To'lovni tasdiqlashda xato yuz berdi.",
        })
        .catch(() => {});
    }
  });

  bot.on("message", async (msg) => {
    if (!msg.successful_payment || !isOwner(msg.from.id)) {
      return;
    }

    const payload = msg.successful_payment.invoice_payload || "";
    if (!payload.startsWith("pro:")) {
      return;
    }

    const [, targetBotId] = payload.split(":");
    const targetBot = await getManagedBot(targetBotId);
    if (!targetBot) {
      return;
    }

    const fromDate = isProActive(targetBot)
      ? new Date(targetBot.proExpiresAt)
      : new Date();
    const nextExpiry = new Date(fromDate.getTime() + PRO_MONTH_MS);

    await botManager.updateBotDocument(targetBotId, {
      proPurchasedAt: new Date(),
      proExpiresAt: nextExpiry,
    });

    await sendOptionalSticker(msg.chat.id, "PRO_SUCCESS_STICKER_ID");
    await bot.sendMessage(
      msg.chat.id,
      `🎉 <b>Pro muvaffaqiyatli yoqildi!</b>\n\n🤖 Bot: @${targetBot.username}\n⭐ To'lov: <b>${PRO_PRICE_STARS} Stars</b>\n📅 Amal qilish muddati: <b>${formatDate(nextExpiry)}</b>\n\nEndi siz 2 tadan ortiq kanal va guruh ulashingiz mumkin.`,
      { parse_mode: "HTML" },
    );
  });

  bot.onText(/\/admin/, async (msg) => {
    if (!isOwner(msg.from.id)) {
      return;
    }

    await bot.sendMessage(
      msg.chat.id,
      "👑 <b>Admin boshqaruv paneli</b>\n\nBarcha muhim sozlamalar shu yerda. Kerakli bo'limni tanlang va botingizni qulay boshqaring.",
      {
        parse_mode: "HTML",
        ...kb.mainMenu(),
        ...kb.adminKeyboard({
          isSuperAdmin: context.isPrimary,
        }),
      },
    );
  });
};
