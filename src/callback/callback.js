const { v4: uuidv4 } = require("uuid");

const kb = require("../handlers/keyboard");
const { getUserModel } = require("../../beckend/User");
const Order = require("../../beckend/Order");
const Kanal = require("../../beckend/Kanal");

module.exports = (bot, context, botManager) => {
  const User = getUserModel(context.botId);

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
          `✨ <b>Stars ⭐ ishlash juda oson!</b>

Har bir do'stingiz sizning havolangiz orqali botni ishga tushirsa, sizga <b>${currentStarsPrice()} Stars</b> yoziladi.

🔗 <b>Sizning maxsus havolangiz:</b>
<code>${botStartLink(userId)}</code>

Do'stlaringizga yuboring va Stars ⭐ yig'ishni boshlang!`,
          { parse_mode: "HTML", ...kb.backMenu() },
        );
        return;
      }

      if (data === "myProfile") {
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        return bot.sendMessage(
          chatId,
          `✨ <b>Profil</b>
──────────────
💬 <b>Ism:</b> ${firstName}
🆔 <code>${userId}</code>
👤 <b>Username:</b> ${query.from.username ? "@" + query.from.username : "yo'q"}
──────────────
👥 <b>Jami do'stlar:</b> ${user.totalInvited || 0}
✅ <b>Botni faollashtirdi:</b> ${user.totalInvited || 0}
💰 <b>Balans:</b> ${user.balance.toFixed(2)} ⭐️

🚀 Dostlarni taklif qilish uchun pastdagi tugmani bosing va dostlaringizni taklif qiling!`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "➕ Taklif qilish",
                    url: `https://t.me/share/url?url=https://t.me/AkaStarsBot?start=${userId}&text=${encodeURIComponent(
                      "🎉 Bu bot orqalik bepul telegram gift olishingizn mumkun ekan. Sinab ko'ring! 🎁",
                    )}`,
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
          `🌟 Xush kelibsiz, ${firstName}!\n\nBu yerda siz do'stlaringizni taklif qilib, Stars ⭐ yig'ib va ularni sovg'alarga almashtirishingiz mumkin.`,
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

      if (data.startsWith("gift_")) {
        const [, rawPrice, giftIcon] = data.split("_");
        const price = Number(rawPrice);

        if (user.balance < price) {
          await bot.sendMessage(
            chatId,
            `😔 Balansingiz yetarli emas. Balanisingiz: <b>${user.balance} ⭐</b>\n\n Yana biroz Stars yig'ib qayting.`,
            { parse_mode: "HTML" },
            kb.backMenu(),
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
          `🧾 <b>Yangi buyurtma keldi</b>

🤖 Bot: @${context.username}

👤 User: <a href="tg://user?id=${userId}">${firstName}</a>${query.from.username ? ` | Username: @${query.from.username}` : ""}
🎁 Gift: ${giftIcon}
💸 Narx: ${price}

🆔 User ID: <code>${userId}</code>
🆔 Order ID: <code>${order.orderId}</code>`,
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
          { botId: context.botId, telegramId: order.userId },
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

      await bot.answerCallbackQuery(query.id).catch(() => {});
    } catch (error) {
      console.error("Callback xatoligi:", error);
    }
  });
};
