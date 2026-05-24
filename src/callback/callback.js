const { v4: uuidv4 } = require("uuid");

const kb = require("../handlers/keyboard");
const { getUserModel } = require("../../beckend/User");
const Order = require("../../beckend/Order");
const Kanal = require("../../beckend/Kanal");
const TopUp = require("../../beckend/TopUp");
const StarsPurchase = require("../../beckend/StarsPurchase");
const {
  getSession,
  setSession,
  clearSession,
} = require("../runtime/sessionStore");

module.exports = (bot, context, botManager) => {
  const User = getUserModel(context.botId);
  const CARD_NUMBER = process.env.CARD_NUMBER || "4073420056948478";

  function currentStarsPrice() {
    return (
      Number(botManager.getRuntime(context.botId)?.botDoc?.starsPrice) ||
      Number(context.starsPrice) ||
      0
    );
  }

  function botStartLink(userId) {
    return `https://t.me/${context.username}?start=${userId}`;
  }

  function isOwner(userId) {
    return Number(userId) === Number(context.ownerId);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[<>&"]/g, (char) => {
      const entities = {
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
      };
      return entities[char] || char;
    });
  }

  function normalizeUsername(input) {
    if (!input) return "";
    const username = String(input).trim().replace(/^@/, "");
    return username;
  }

  function getStarsPackage(starsAmount) {
    return kb.STARS_PACKAGES.find((item) => item.stars === Number(starsAmount));
  }

  async function sendOptionalSticker(chatId, envKey) {
    const stickerId = process.env[envKey];
    if (!stickerId) return;
    await bot.sendSticker(chatId, stickerId).catch(() => {});
  }

  async function enforceSubscription(query) {
    if (Number(query.from.id) === Number(context.ownerId)) {
      return false;
    }

    const channels = await Kanal.find({ botId: context.botId });
    const missingChannels = [];

    for (const channel of channels) {
      try {
        const res = await bot.getChatMember(channel.kanalId, query.from.id);
        if (res.status === "left" || res.status === "kicked") {
          missingChannels.push([
            {
              text: `📢 ${channel.kanalNomi}`,
              url: `https://t.me/${channel.kanalURL.replace("@", "")}`,
            },
          ]);
        }
      } catch (error) {
        console.log(
          `Kanal tekshirishda xato ${channel.kanalURL}:`,
          error.message,
        );
      }
    }

    if (missingChannels.length === 0 || query.data.startsWith("check_sub_")) {
      return false;
    }

    missingChannels.push([
      { text: "✅ Tekshirish", callback_data: "check_sub_none" },
    ]);
    await bot
      .deleteMessage(query.message.chat.id, query.message.message_id)
      .catch(() => {});
    await bot.sendMessage(
      query.message.chat.id,
      "🔐 Davom etish uchun barcha kanallarga obuna bo'ling va keyin tekshirish tugmasini bosing.",
      { reply_markup: { inline_keyboard: missingChannels } },
    );
    return true;
  }

  async function createStarsPurchaseRequest({
    chatId,
    user,
    query,
    session,
    starsAmount,
  }) {
    const packageInfo = getStarsPackage(starsAmount);
    if (!packageInfo) {
      await bot.sendMessage(
        chatId,
        "Tanlangan Stars paketi topilmadi.",
        kb.backMenu(),
      );
      clearSession(context.botId, chatId);
      return;
    }

    if (user.somBalance < packageInfo.price) {
      await sendOptionalSticker(chatId, "LOW_BALANCE_STICKER_ID");
      setSession(context.botId, chatId, {
        ...session,
        step: "waiting_topup_receipt",
        topUpStars: packageInfo.stars,
        topUpPrice: packageInfo.price,
      });

      await bot.sendMessage(
        chatId,
        `💳 <b>Balans yetarli emas</b>\n\nSiz tanlagan paket narxi: <b>${packageInfo.price.toLocaleString("uz-UZ")} so'm</b>\nSizning hamyoningiz: <b>${(user.somBalance || 0).toLocaleString("uz-UZ")} so'm</b>\n\nDavom etish uchun avval hamyonni to'ldiring.`,
        {
          parse_mode: "HTML",
          ...kb.insufficientBalanceButtons(packageInfo.stars),
        },
      );
      return;
    }

    const request = await StarsPurchase.create({
      botId: context.botId,
      requestId: uuidv4(),
      requesterId: query.from.id,
      requesterUsername: query.from.username || "",
      requesterFirstName: query.from.first_name || "",
      recipientType: session.recipientType,
      recipientUsername: session.recipientUsername,
      starsAmount: packageInfo.stars,
      paymentAmount: packageInfo.price,
    });

    user.somBalance -= packageInfo.price;
    await user.save();
    clearSession(context.botId, chatId);

    const recipientUsername = session.recipientUsername;
    await bot.sendMessage(
      context.ownerId,
      `⭐ <b>Yangi Stars sotib olish buyurtmasi</b>\n\n👤 Xaridor: <a href="tg://user?id=${query.from.id}">${escapeHtml(query.from.first_name)}</a>${query.from.username ? ` | @${escapeHtml(query.from.username)}` : ""}\n🎯 Kim uchun: @${escapeHtml(recipientUsername)}\n⭐ Miqdor: <b>${packageInfo.stars} Stars</b>\n💰 Paket narxi: <b>${packageInfo.price.toLocaleString("uz-UZ")} so'm</b>\n💳 Ichki balansdan yechildi: <b>${packageInfo.stars} Stars</b>\n🆔 Request ID: <code>${request.requestId}</code>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "👤 Profilga o'tish",
                url: `https://t.me/${recipientUsername}`,
              },
            ],
            [
              {
                text: "✅ Tasdiqlash",
                callback_data: `starsbuy_approve_${request.requestId}`,
              },
            ],
            [
              {
                text: "❌ Bekor qilish",
                callback_data: `starsbuy_reject_${request.requestId}`,
              },
            ],
          ],
        },
      },
    );

    await bot.sendMessage(
      chatId,
      `✨ <b>Buyurtmangiz qabul qilindi</b>\n\n🎯 Qabul qiluvchi: @${escapeHtml(recipientUsername)}\n⭐ Miqdor: <b>${packageInfo.stars} Stars</b>\n\nAdmin tekshiruvdan so'ng Stars yuboriladi.`,
      {
        parse_mode: "HTML",
        ...kb.backMenu(),
      },
    );
  }

  bot.on("message", async (msg) => {
    if (!context.isPrimary || !msg.chat) {
      return;
    }

    const chatId = msg.chat.id;
    const session = getSession(context.botId, chatId);
    if (!session) {
      return;
    }

    if (
      session.step === "waiting_buy_other_username" &&
      msg.text &&
      !msg.text.startsWith("/")
    ) {
      const username = normalizeUsername(msg.text);
      if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
        await bot.sendMessage(
          chatId,
          "⚠️ Username noto'g'ri formatda.\n\nNamuna: <code>@example_user</code>",
          { parse_mode: "HTML" },
        );
        return;
      }

      setSession(context.botId, chatId, {
        ...session,
        step: "waiting_buy_package",
        recipientType: "other",
        recipientUsername: username,
      });

      await bot.sendMessage(
        chatId,
        `🎯 <b>Qabul qiluvchi qabul qilindi</b>\n\nStars yuboriladigan username: <b>@${escapeHtml(username)}</b>\n\nEndi kerakli paketni tanlang.`,
        {
          parse_mode: "HTML",
          ...kb.starsPackageMenu("purchase_pkg"),
        },
      );
      return;
    }

    if (
      session.step === "waiting_custom_topup_amount" &&
      msg.text &&
      !msg.text.startsWith("/")
    ) {
      const amount = Number(msg.text.replace(/\D/g, ""));
      if (!amount || amount < 2000 || amount > 1000000) {
        await bot.sendMessage(
          chatId,
          "⚠️ Iltimos, 2 000 so'mdan 1 000 000 so'mgacha bo'lgan miqdor kiriting (faqat raqamlar).",
        );
        return;
      }

      setSession(context.botId, chatId, {
        ...session,
        step: "waiting_topup_receipt",
        topUpStars: 0,
        topUpPrice: amount,
      });

      await bot.sendMessage(
        chatId,
        `💳 <b>To'lov ma'lumotlari</b>\n\nTo'lov summasi: <b>${amount.toLocaleString("uz-UZ")} so'm</b>\n\n🏦 Karta raqam:\n<code>${CARD_NUMBER}</code>\n<b>Qabul qiluvchi:</b> A. T.\n\nIltimos, to'lovni amalga oshirib, chek rasmini yuboring.`,
        { parse_mode: "HTML" },
      );
      return;
    }

    if (session.step === "waiting_topup_receipt") {
      const receiptPhoto = msg.photo?.length
        ? msg.photo[msg.photo.length - 1].file_id
        : null;
      const receiptDocument = msg.document?.file_id || null;
      const receiptType = receiptPhoto
        ? "photo"
        : receiptDocument
          ? "document"
          : null;
      const receiptFileId = receiptPhoto || receiptDocument;

      if (!receiptFileId) {
        if (msg.text && !msg.text.startsWith("/")) {
          await bot.sendMessage(
            chatId,
            "📎 Iltimos, to'lov chekini rasm yoki fayl ko'rinishida yuboring.",
          );
        }
        return;
      }

      setSession(context.botId, chatId, {
        ...session,
        receiptType,
        receiptFileId,
        step: "waiting_topup_submit",
      });

      await bot.sendMessage(
        chatId,
        "✅ Chek qabul qilindi.\n\nHammasi to'g'ri bo'lsa, pastdagi `To'lov qildim` tugmasini bosing.",
        {
          parse_mode: "Markdown",
          ...kb.paymentActionButtons(),
        },
      );
      return;
    }
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;
    const userId = query.from.id;
    const firstName = query.from.first_name;

    try {
      if (await enforceSubscription(query)) {
        await bot.answerCallbackQuery(query.id).catch(() => {});
        return;
      }

      let user = await User.findOne({ telegramId: userId });
      if (!user) {
        user = await User.create({
          botId: context.botId,
          telegramId: userId,
          firstName,
          username: query.from.username,
        });
      }

      if (data === "balance") {
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(
          chatId,
          `💰 <b>Sizning balansingiz</b>\n\nHozir hisobingizda <b>${user.balance.toFixed(1)} Stars ⭐</b> mavjud.`,
          { parse_mode: "HTML", ...kb.backMenu() },
        );
        return;
      }

      if (data === "invite") {
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(
          chatId,
          `✨ <b>Stars ishlash juda oson!</b>\n\nHar bir do'stingiz sizning havolangiz orqali botni ishga tushirsa, sizga <b>${currentStarsPrice()} Stars</b> yoziladi.\n\n🔗 <b>Sizning maxsus havolangiz:</b>\n<code>${botStartLink(userId)}</code>\n\nDo'stlaringizga yuboring va Stars ⭐ yig'ishni boshlang!`,
          { parse_mode: "HTML", ...kb.backMenu() },
        );
        return;
      }

      if (data === "myProfile") {
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(
          chatId,
          `✨ <b>Profil</b>\n──────────────\n💬 <b>Ism:</b> ${escapeHtml(firstName)}\n🆔 <code>${userId}</code>\n👤 <b>Username:</b> ${query.from.username ? `@${escapeHtml(query.from.username)}` : "yo'q"}\n──────────────\n👥 <b>Jami do'stlar:</b> ${user.totalInvited || 0}\n✅ <b>Botni faollashtirdi:</b> ${user.totalInvited || 0}\n💰 <b>Stars balans:</b> ${user.balance.toFixed(2)} ⭐\n <b>Hamyon:</b> ${user.somBalance?.toLocaleString("uz-UZ") || 0} so'm\n💳 <b>Jami to'ldirilgan:</b> ${user.totalTopUpSom?.toLocaleString("uz-UZ") || 0} so'm\n\n🚀 Do'stlaringizni taklif qilib Stars yig'ishni davom ettiring!`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "➕ Taklif qilish",
                    url: `https://t.me/share/url?url=${encodeURIComponent(botStartLink(userId))}&text=${encodeURIComponent("🎉 Bu bot orqali Stars va sovg'alar olish mumkin. Sinab ko'ring!")}`,
                  },
                ],
                [{ text: "⬅️ Orqaga", callback_data: "exit" }],
              ],
            },
          },
        );
        return;
      }

      if (data === "topReferrals") {
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        const topUsers = await User.find({})
          .sort({ totalInvited: -1 })
          .limit(10);
        const lines = topUsers
          .filter((item) => item.totalInvited > 0)
          .map(
            (item, index) =>
              `${index + 1}. ${(item.firstName || "Foydalanuvchi").replace(/[<>]/g, "")} - ${item.totalInvited} ta`,
          );

        await bot.sendMessage(
          chatId,
          lines.length
            ? `🏆 <b>Top referallar</b>\n\n${lines.join("\n")}`
            : "🌥 Hozircha referallar ro'yxati bo'sh.",
          { parse_mode: "HTML", ...kb.backMenu() },
        );
        return;
      }

      if (data === "exit") {
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(
          chatId,
          `🌟 Xush kelibsiz, ${escapeHtml(firstName)}!\n\nBu yerda siz do'stlaringizni taklif qilib, Stars ⭐ yig'ib va ularni sovg'alarga almashtirishingiz mumkin.`,
          kb.mainMenu(),
        );
        return;
      }

      if (data === "withdraw") {
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(
          chatId,
          `🎁 <b>Sovg'alar bo'limi</b>\n\nBalansingiz: <b>${user.balance.toFixed(1)} ⭐</b>\nO'zingizga yoqqan sovg'ani tanlang.`,
          { parse_mode: "HTML", ...kb.giftMenu() },
        );
        return;
      }

      if (data === "buyStars") {
        if (!context.isPrimary) {
          await bot.answerCallbackQuery(query.id, {
            text: "Bu funksiya faqat asosiy botda ishlaydi.",
            show_alert: true,
          });
          return;
        }

        clearSession(context.botId, chatId);
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await sendOptionalSticker(chatId, "BUY_STARS_STICKER_ID");
        await bot.sendMessage(
          chatId,
          `⭐ <b>Stars sotib olish</b>\n\nStarslarni kim uchun xarid qilmoqchisiz?`,
          {
            parse_mode: "HTML",
            ...kb.buyStarsTargetMenu(),
          },
        );
        return;
      }

      if (data === "buyStars_self") {
        if (!query.from.username) {
          await bot.sendMessage(
            chatId,
            "⚠️ O'zingiz uchun Stars sotib olishdan oldin Telegram username o'rnating.",
          );
          return;
        }

        setSession(context.botId, chatId, {
          step: "waiting_buy_package",
          recipientType: "self",
          recipientUsername: normalizeUsername(query.from.username),
        });

        await bot.sendMessage(
          chatId,
          `🙋 <b>O'zingiz uchun tanlandi</b>\n\nQabul qiluvchi: <b>@${escapeHtml(query.from.username)}</b>\n\nEndi kerakli paketni tanlang.`,
          {
            parse_mode: "HTML",
            ...kb.starsPackageMenu("purchase_pkg"),
          },
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "buyStars_other") {
        setSession(context.botId, chatId, {
          step: "waiting_buy_other_username",
        });

        await bot.sendMessage(
          chatId,
          "🎁 <b>Boshqa odamga Stars yuborish</b>\n\nIltimos, qabul qiluvchining username sini yuboring.\n\nNamuna: <code>@example_user</code>",
          { parse_mode: "HTML" },
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data.startsWith("purchase_pkg_")) {
        const starsAmount = Number(data.replace("purchase_pkg_", ""));
        const session = getSession(context.botId, chatId);

        if (!session || session.step !== "waiting_buy_package") {
          await bot.sendMessage(
            chatId,
            "Jarayon eskirdi. Qaytadan `Stars sotib olish` ni bosing.",
          );
          await bot.answerCallbackQuery(query.id);
          return;
        }

        await createStarsPurchaseRequest({
          chatId,
          user,
          query,
          session,
          starsAmount,
        });
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "topup_custom") {
        setSession(context.botId, chatId, {
          step: "waiting_custom_topup_amount",
        });
        await bot.sendMessage(
          chatId,
          "💰 <b>Qancha miqdorda (so'mda) to'ldirmoqchisiz?</b>\n\nMasalan: <code>50000</code>",
          { parse_mode: "HTML" },
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data.startsWith("topup_start_")) {
        const starsAmount = Number(data.replace("topup_start_", ""));
        const packageInfo = getStarsPackage(starsAmount);
        if (!packageInfo) {
          await bot.answerCallbackQuery(query.id, {
            text: "Paket topilmadi",
            show_alert: true,
          });
          return;
        }

        setSession(context.botId, chatId, {
          step: "waiting_topup_receipt",
          topUpStars: packageInfo.stars,
          topUpPrice: packageInfo.price,
        });

        await sendOptionalSticker(chatId, "TOPUP_STICKER_ID");
        await bot.sendMessage(
          chatId,
          `💳 <b>Balansni to'ldirish</b>\n\nTanlangan paket: <b>${packageInfo.stars} Stars</b>\nTo'lov summasi: <b>${packageInfo.price.toLocaleString("uz-UZ")} so'm</b>\n\n🏦 Karta raqam:\n<code>${CARD_NUMBER}</code>\n<b>Qabul qiluvchi:</b> A. T.\n\nIltimos, to'lovni amalga oshirib, chek rasmini yoki faylini botga yuboring.`,
          { parse_mode: "HTML" },
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "topup_submit") {
        const session = getSession(context.botId, chatId);
        if (
          !session ||
          session.step !== "waiting_topup_submit" ||
          !session.receiptFileId
        ) {
          await bot.answerCallbackQuery(query.id, {
            text: "Avval to'lov chekini yuboring.",
            show_alert: true,
          });
          return;
        }

        const request = await TopUp.create({
          botId: context.botId,
          requestId: uuidv4(),
          userId: query.from.id,
          username: query.from.username || "",
          firstName: query.from.first_name || "",
          starsAmount: session.topUpStars,
          paymentAmount: session.topUpPrice,
          receiptType: session.receiptType,
          receiptFileId: session.receiptFileId,
        });

        const adminCaption =
          `💳 <b>Yangi balans to'ldirish so'rovi</b>\n\n` +
          `👤 User: <a href="tg://user?id=${query.from.id}">${escapeHtml(query.from.first_name)}</a>${query.from.username ? ` | @${escapeHtml(query.from.username)}` : ""}\n` +
          `⭐ To'ldiriladigan Stars: <b>${session.topUpStars}</b>\n` +
          `💰 To'lov summasi: <b>${session.topUpPrice.toLocaleString("uz-UZ")} so'm</b>\n` +
          `🆔 Request ID: <code>${request.requestId}</code>`;

        if (session.receiptType === "photo") {
          await bot.sendPhoto(context.ownerId, session.receiptFileId, {
            caption: adminCaption,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Tasdiqlash",
                    callback_data: `topup_approve_${request.requestId}`,
                  },
                ],
                [
                  {
                    text: "❌ Bekor qilish",
                    callback_data: `topup_reject_${request.requestId}`,
                  },
                ],
              ],
            },
          });
        } else {
          await bot.sendDocument(context.ownerId, session.receiptFileId, {
            caption: adminCaption,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Tasdiqlash",
                    callback_data: `topup_approve_${request.requestId}`,
                  },
                ],
                [
                  {
                    text: "❌ Bekor qilish",
                    callback_data: `topup_reject_${request.requestId}`,
                  },
                ],
              ],
            },
          });
        }

        clearSession(context.botId, chatId);
        await bot.sendMessage(
          chatId,
          "📨 So'rovingiz adminga yuborildi.\n\nTo'lov tasdiqlangach balansingiz to'ldiriladi.",
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === "cancel_topup" || data === "cancel_buy_stars") {
        clearSession(context.botId, chatId);
        await bot.sendMessage(
          chatId,
          "❌ Jarayon bekor qilindi.",
          kb.backMenu(),
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data.startsWith("gift_")) {
        const [, rawPrice, giftIcon] = data.split("_");
        const price = Number(rawPrice);

        if (user.balance < price) {
          await bot.sendMessage(
            chatId,
            `😔 Balansingiz yetarli emas. Balansingiz: <b>${user.balance} ⭐</b>\n\nYana biroz Stars yig'ib qayting.`,
            { parse_mode: "HTML", ...kb.backMenu() },
          );
          return;
        }

        if (user.totalInvited < 10) {
          await bot.sendMessage(
            chatId,
            `🚧 Yechib olish uchun kamida <b>10 ta referal</b> kerak.\n\nSizda hozircha: <b>${user.totalInvited}</b> ta referal bor.`,
            { parse_mode: "HTML", ...kb.backMenu() },
          );
          return;
        }

        const order = await Order.create({
          botId: context.botId,
          ownerId: context.ownerId,
          orderId: uuidv4(),
          userId,
          username: query.from.username || "",
          gift: giftIcon || "gift",
          price,
        });

        user.balance -= price;
        await user.save();

        await bot.sendMessage(
          context.ownerId,
          `🧾 <b>Yangi buyurtma keldi</b>\n\n🤖 Bot: @${context.username}\n👤 User: <a href="tg://user?id=${userId}">${escapeHtml(firstName)}</a>${query.from.username ? ` | Username: @${escapeHtml(query.from.username)}` : ""}\n🎁 Gift: ${giftIcon}\n💸 Narx: ${price}\n🆔 User ID: <code>${userId}</code>\n🆔 Order ID: <code>${order.orderId}</code>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Tasdiqlash",
                    callback_data: `confirm_${order.orderId}`,
                  },
                ],
                [
                  {
                    text: "❌ Bekor qilish",
                    callback_data: `cancel_${order.orderId}`,
                  },
                ],
              ],
            },
          },
        );

        await bot.deleteMessage(chatId, messageId).catch(() => {});
        await bot.sendMessage(
          chatId,
          "🎉 Buyurtmangiz qabul qilindi!\nAdmin tekshiruvdan so'ng sizga xabar beradi.",
          kb.backMenu(),
        );
        return;
      }

      if (data.startsWith("confirm_")) {
        if (!isOwner(query.from.id)) {
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const orderId = data.replace("confirm_", "");
        const order = await Order.findOne({ botId: context.botId, orderId });
        if (!order) {
          await bot.answerCallbackQuery(query.id, {
            text: "Order topilmadi",
            show_alert: true,
          });
          return;
        }

        await Order.deleteOne({ _id: order._id });
        await bot.sendMessage(
          order.userId,
          "✅ Ajoyib! Buyurtmangiz tasdiqlandi.",
        );
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        );
        await bot.answerCallbackQuery(query.id, { text: "Tasdiqlandi ✅" });
        return;
      }

      if (data.startsWith("cancel_")) {
        if (!isOwner(query.from.id)) {
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const orderId = data.replace("cancel_", "");
        const order = await Order.findOne({ botId: context.botId, orderId });
        if (!order) {
          await bot.answerCallbackQuery(query.id, {
            text: "Order topilmadi",
            show_alert: true,
          });
          return;
        }

        await Order.deleteOne({ _id: order._id });
        await User.updateOne(
          { telegramId: order.userId },
          { $inc: { balance: order.price } },
        );
        await bot.sendMessage(
          order.userId,
          "❌ Buyurtmangiz bekor qilindi.\nStars balansingizga qaytarildi.",
        );
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        );
        await bot.answerCallbackQuery(query.id, { text: "Bekor qilindi ❌" });
        return;
      }

      if (data.startsWith("topup_approve_")) {
        if (!isOwner(query.from.id)) {
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const requestId = data.replace("topup_approve_", "");
        const request = await TopUp.findOne({ requestId, status: "pending" });
        if (!request) {
          await bot.answerCallbackQuery(query.id, {
            text: "So'rov topilmadi",
            show_alert: true,
          });
          return;
        }

        const RequestUser = getUserModel(request.botId);
        await RequestUser.updateOne(
          { telegramId: request.userId },
          {
            $inc: {
              somBalance: request.paymentAmount,
              totalTopUpSom: request.paymentAmount,
            },
          },
        );
        request.status = "approved";
        await request.save();

        await bot.sendMessage(
          request.userId,
          `✅ Hamyoningiz muvaffaqiyatli to'ldirildi.\n\n💰 Qo'shildi: ${request.paymentAmount.toLocaleString("uz-UZ")} so'm`,
        );
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        );
        await bot.answerCallbackQuery(query.id, {
          text: "Balans to'ldirildi ✅",
        });
        return;
      }

      if (data.startsWith("topup_reject_")) {
        if (!isOwner(query.from.id)) {
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const requestId = data.replace("topup_reject_", "");
        const request = await TopUp.findOne({ requestId, status: "pending" });
        if (!request) {
          await bot.answerCallbackQuery(query.id, {
            text: "So'rov topilmadi",
            show_alert: true,
          });
          return;
        }

        request.status = "rejected";
        await request.save();
        await bot.sendMessage(
          request.userId,
          "❌ Balans to'ldirish so'rovingiz rad etildi.\nIltimos, to'lov ma'lumotlarini tekshirib qayta urinib ko'ring.",
        );
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        );
        await bot.answerCallbackQuery(query.id, {
          text: "So'rov rad etildi ❌",
        });
        return;
      }

      if (data.startsWith("starsbuy_approve_")) {
        if (!isOwner(query.from.id)) {
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const requestId = data.replace("starsbuy_approve_", "");
        const request = await StarsPurchase.findOne({
          requestId,
          status: "pending",
        });
        if (!request) {
          await bot.answerCallbackQuery(query.id, {
            text: "Buyurtma topilmadi",
            show_alert: true,
          });
          return;
        }

        request.status = "approved";
        await request.save();
        await bot.sendMessage(
          request.requesterId,
          `✅ Stars sotib olish buyurtmangiz tasdiqlandi.\n\n🎯 Qabul qiluvchi: @${request.recipientUsername}\n⭐ Miqdor: ${request.starsAmount} Stars`,
        );
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        );
        await bot.answerCallbackQuery(query.id, {
          text: "Stars buyurtma tasdiqlandi ✅",
        });
        return;
      }

      if (data.startsWith("starsbuy_reject_")) {
        if (!isOwner(query.from.id)) {
          await bot.answerCallbackQuery(query.id);
          return;
        }

        const requestId = data.replace("starsbuy_reject_", "");
        const request = await StarsPurchase.findOne({
          requestId,
          status: "pending",
        });
        if (!request) {
          await bot.answerCallbackQuery(query.id, {
            text: "Buyurtma topilmadi",
            show_alert: true,
          });
          return;
        }

        const RequestUser = getUserModel(request.botId);
        await RequestUser.updateOne(
          { telegramId: request.requesterId },
          { $inc: { balance: request.starsAmount } },
        );
        request.status = "rejected";
        await request.save();

        await bot.sendMessage(
          request.requesterId,
          `❌ Stars sotib olish buyurtmangiz rad etildi.\n\nYechildigan Stars balansingizga qaytarildi: ${request.starsAmount} Stars`,
        );
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        );
        await bot.answerCallbackQuery(query.id, {
          text: "Buyurtma rad etildi ❌",
        });
        return;
      }

      await bot.answerCallbackQuery(query.id).catch(() => {});
    } catch (error) {
      console.error("Callback xatoligi:", error);
    }
  });
};
