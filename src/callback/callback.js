const kb = require("../handlers/keyboard");
const User = require("../../beckend/User");
const Order = require("../../beckend/Order");
const Kanal = require("../../beckend/Kanal"); // Kanal modelini qo'shdik
const { v4: uuidv4 } = require("uuid");

module.exports = (bot) => {
  bot.on("callback_query", async (query) => {
    const chatID = query.message.chat.id;
    const messageID = query.message.message_id;
    const data = query.data;
    const firstName = query.from.first_name;
    const userId = query.from.id;
    const ADMIN_ID = 907402803;

    try {
      // --- MAJBURIY OBUNA TEKSHIRUVI (Tugma bosilganda) ---
      if (userId !== ADMIN_ID) {
        const kanallar = await Kanal.find({});
        let azaBolmaganKanallar = [];

        for (const kanal of kanallar) {
          try {
            const res = await bot.getChatMember(kanal.kanalId, userId);
            if (res.status === "left" || res.status === "kicked") {
              azaBolmaganKanallar.push([
                {
                  text: kanal.kanalNomi,
                  url: `https://t.me/${kanal.kanalURL.replace("@", "")}`,
                },
              ]);
            }
          } catch (e) {
            console.log(`Kanal tekshirishda xato: ${kanal.kanalURL}`);
          }
        }

        // Agar a'zo bo'lmagan bo'lsa va "Tekshirish" tugmasini bosmagan bo'lsa
        if (azaBolmaganKanallar.length > 0 && !data.startsWith("check_sub")) {
          await bot.deleteMessage(chatID, messageID).catch(() => {});

          azaBolmaganKanallar.push([
            {
              text: "🔄 Tekshirish",
              callback_data: `check_sub_none`,
            },
          ]);

          return bot.sendMessage(
            chatID,
            `⚠️ Kechirasiz ${firstName}, botdan foydalanish uchun quyidagi kanallarga obuna bo'lishingiz shart:`,
            { reply_markup: { inline_keyboard: azaBolmaganKanallar } },
          );
        }
      }
      // --- TEKSHIRUV TUGADI ---

      let user = await User.findOne({ telegramId: userId });
      if (!user) {
        user = await User.create({ telegramId: userId, firstName: firstName });
      }

      // 1. ASOSIY MENYU TUGMALARI
      switch (data) {
        case "balance":
        case "invite":
        case "exit":
        case "withdraw":
        case "myProfile":
        case "topReferrals":
        case "confirm":
        case "cancel":
          // Faqat mana shu asosiy bo'limlarga o'tgandagina eski xabarni o'chiramiz
          await bot.deleteMessage(chatID, messageID).catch(() => {});

          if (data === "balance") {
            return bot.sendMessage(
              chatID,
              `💰 Balans: *${user.balance.toFixed(1)} STARS* 🌟`,
              { parse_mode: "Markdown", ...kb.ortga },
            );
          }
          if (data === "invite") {
            return bot.sendMessage(
              chatID,
              `🎉 **Do'stlarni taklif qiling va havolangiz orqali botni faollashtirgan har bir kishi uchun 2 ⭐️ ga ega bo'ling!**\n\n` +
                `🔗 **Sizning shaxsiy havolangiz (nusxalash uchun bosing):**\n\n` +
                `\`https://t.me/AkaStarsBot?start=${userId}\`\n\n` +
                `🚀 **Havolani qanday tarqatish mumkin?**\n` +
                `• Shaxsiy xabarlarda yuboring 👥\n` +
                `• Telegram Stories yoki kanallarda ulashing 📱\n` +
                `• TikTok, Instagram va boshqa ijtimoiy tarmoqlarda tarqating 🌍\n\n` +
                `❗️ _Sizning starsingiz biz tomondan 100% to'lab beriladi_`,
              { parse_mode: "Markdown", ...kb.ortga },
            );
          }
          if (data === "myProfile") {
            return bot.sendMessage(
              chatID,
              `✨ *Profil*\n` +
                `──────────────\n` +
                `💬 *Ism:* ${firstName}\n` +
                `🆔 *ID:* \`${userId}\`\n` +
                `👤 *Username:* @${query.from.username || "yo'q"}\n` +
                `──────────────\n` +
                `👥 *Jami do'stlar:* ${user.totalInvited}\n` +
                `✅ *Botni faollashtirdi:* ${user.totalInvited}\n` +
                `💰 *Balans:* ${user.balance.toFixed(2)} ⭐️\n\n_🚀 Dostlarni taklif qilish uchun pastdagi tugmani bosing va dostlaringizni taklif qiling!_ `,
              {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "➕ Taklif qilish",
                        url: `https://t.me/share/url?url=https://t.me/AkaStarsBot?start=${userId}&text=${encodeURIComponent("🎉 Do'stim, mana bu botda bepul Stars yig'ishing mumkin! Hozir kirib ko'ring! 🎁")}`,
                      },
                    ],
                    [{ text: "⬅️ Orqaga", callback_data: "exit" }],
                  ],
                },
              },
            );
          }

          if (data === "topReferrals") {
            try {
              const topUsers = await User.find()
                .sort({ totalInvited: -1 })
                .limit(10);

              if (topUsers.length > 0) {
                let text = `🏆 **Top 10 taklif qiluvchilar:**\n\n`;

                topUsers.forEach((u, index) => {
                  if (!u.totalInvited || u.totalInvited === 0) return;
                  const name = u.firstName
                    ? u.firstName.replace(/[<>]/g, "")
                    : "Foydalanuvchi";
                  text += `*${index + 1}.* ${name} — **${u.totalInvited}** ta do'st 👤\n`;
                });

                return bot.sendMessage(chatID, text, {
                  parse_mode: "Markdown",
                  ...kb.ortga,
                });
              } else {
                return bot.sendMessage(
                  chatID,
                  "🏆 Hozircha hech kim do'st taklif qilmagan.",
                  kb.ortga,
                );
              }
            } catch (error) {
              console.error("TopReferrals xatoligi:", error);
              bot.answerCallbackQuery(query.id, {
                text: "Ma'lumot yuklashda xato yuz berdi.",
              });
            }
          }

          if (data === "exit") {
            return bot.sendMessage(
              chatID,
              `🌟 Xush kelibsiz, ${firstName}!

Bu yerda siz foydalanuvchilarni taklif qilishingiz va har biri uchun 2 ⭐ (stars)  olishingiz mumkin.

🚀 Bu qanday ishlaydi?
«⭐️ Yulduz ishlash» tugmasini bosing, havolangizni nusxalang va uni do'stlaringizga yuboring. Mukofotga ega bo'ling!

🎁 Ishlab topgan yulduzlaringizni sovg'a sifatida sizga tashlab beramiz!

👇 Hoziroq boshlang!`,
              {
                parse_mode: "Markdown",
                ...kb.mainMenyu,
              },
            );
          }
          if (data === "withdraw") {
            return bot.sendMessage(
              chatID,
              `💰 <b>Balans: ${user.balance.toFixed(1)}</b> 🌟\n\n‼️ <b>Shartlar:</b>\n— 5 ta do'st taklif qilish\n— Kanalga a'zo bo'lish <a href="https://t.me/Aka_Stars">Aka Stars</a> \n\n<blockquote>✅ Tezkor yechib olish!</blockquote>\n\nYechib olmoqchi bolgan sovgangsini tanlang!`,
              { parse_mode: "HTML", ...kb.sovgalarRoyihati },
            );
          }
          break;
      }

      if (data.startsWith("gift_")) {
        const parts = data.split("_");
        const price = Number(parts[1]);
        const giftIcon = parts[2] || "🎁";

        if (user.balance < price) {
          return bot.answerCallbackQuery(query.id, {
            text: "❌ Balans yetarli emas",
            show_alert: true,
          });
        }

        if (user.totalInvited < 5) {
          return bot.answerCallbackQuery(query.id, {
            text: "⚠️ Kamida 5 ta do‘st taklif qilishingiz kerak",
            show_alert: true,
          });
        }

        const order = await Order.create({
          orderId: uuidv4(),
          userId: userId,
          username: query.from.username || "",
          gift: giftIcon,
          price: price,
        });

        await bot.sendMessage(
          process.env.ADMIN_ID || 907402803,
          `🧾 <b>Yangi buyurtma!</b>\n\n👤 User: <a href="tg://user?id=${userId}">${firstName}</a> (${userId})\n🎁 Sovg‘a: ${giftIcon}\n💰 Narxi: ${price} ⭐\n🆔 Order ID: \`${order.orderId}\``,
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

        user.balance -= price;
        await user.save();
        await bot.deleteMessage(chatID, messageID).catch(() => {});

        return bot.sendMessage(
          chatID,
          "🎉 Buyurtmangiz qabul qilindi!\nAdmin tekshirayotgan paytda kuting ⏳",
          kb.ortga,
        );
      }

      if (data.startsWith("confirm_")) {
        const orderId = data.split("_")[1];
        const order = await Order.findOne({ orderId });
        if (!order)
          return bot.answerCallbackQuery(query.id, {
            text: "❌ Order topilmadi",
            show_alert: true,
          });

        await Order.updateOne({ orderId }, { $set: { status: "confirmed" } });
        await bot.sendMessage(
          order.userId,
          `✅ Sizning buyurtmangiz tasdiqlandi! 🎉 Admin sizga sovgani yubordi uni profilingizda ko'rishingiz mumkin.`,
        );
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatID, message_id: messageID },
        );
        return bot.answerCallbackQuery(query.id, {
          text: "Order tasdiqlandi!",
        });
      }

      if (data.startsWith("cancel_")) {
        const orderId = data.split("_")[1];
        const order = await Order.findOne({ orderId });
        if (!order)
          return bot.answerCallbackQuery(query.id, {
            text: "❌ Order topilmadi",
            show_alert: true,
          });

        await Order.updateOne({ orderId }, { $set: { status: "canceled" } });
        await bot.sendMessage(
          order.userId,
          `❌ Sizning buyurtmangiz bekor qilindi.`,
        );
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatID, message_id: messageID },
        );
        return bot.answerCallbackQuery(query.id, {
          text: "Order bekor qilindi!",
        });
      }

      await bot.answerCallbackQuery(query.id).catch(() => {});
    } catch (error) {
      console.error("Callback xatoligi:", error);
    }
  });
};
