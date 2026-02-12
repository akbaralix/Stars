const path = require("path");
const kb = require("./keyboard");
const User = require("../../beckend/User");
const Kanal = require("../../beckend/Kanal");

const ADMIN_ID = Number(process.env.ADMIN_ID);
module.exports = (bot) => {
  const handleStartLogic = async (chatId, fromUser, referrerId) => {
    const userId = fromUser.id;
    const firstName = fromUser.first_name;
    const username = fromUser.username;
    const STARS_PRICE = Number(process.env.STARS_PRICE) || 0; // Son ko'rinishiga o'tkazildi

    try {
      // 🔐 ADMIN — darhol menyu (TEZLIK UCHUN)
      if (userId === ADMIN_ID) {
        return bot.sendMessage(chatId, "Salom admin, menyudan tanlang:", {
          ...kb.adminKeyboard,
          ...kb.mainMenyu,
        });
      }

      // 1. Kanallarni tekshirish (TEZ VARIANT)
      const kanallar = await Kanal.find({});
      let azaBolmaganKanallar = [];

      const checks = kanallar.map((kanal) =>
        bot
          .getChatMember(kanal.kanalId, userId)
          .then((res) => ({ kanal, res }))
          .catch(() => null),
      );

      const results = await Promise.all(checks);

      for (const item of results) {
        if (!item) continue;

        const { kanal, res } = item;

        if (res.status === "left" || res.status === "kicked") {
          azaBolmaganKanallar.push([
            {
              text: kanal.kanalNomi,
              url: `https://t.me/${kanal.kanalURL.replace("@", "")}`,
            },
          ]);
        }
      }

      // 2. Agar hali a'zo bo'lmagan bo'lsa - TO'XTATISH
      if (azaBolmaganKanallar.length > 0) {
        azaBolmaganKanallar.push([
          {
            text: "🔄 Tekshirish",
            callback_data: `check_sub_${referrerId || "none"}`,
          },
        ]);

        return bot.sendMessage(
          chatId,
          `👋 Salom ${firstName}!\n\nBotdan foydalanish uchun qolgan kanallarga ham obuna bo'ling:`,
          { reply_markup: { inline_keyboard: azaBolmaganKanallar } },
        );
      }

      // 3. --- AGAR HAMMA KANALGA A'ZO BO'LGAN BO'LSA ---
      let user = await User.findOne({ telegramId: userId });

      // Foydalanuvchi bazada yo'q bo'lsa, yangi yaratamiz
      if (!user) {
        user = new User({
          telegramId: userId,
          firstName: firstName,
          username: username,
          invitedBy: referrerId && referrerId != userId ? referrerId : null,
          isSubscribed: false, // Hali mukofot berilmagan holat
        });
        await user.save();
      }

      // 🎁 FAQAT BIR MARTA (isSubscribed false bo'lgandagina) BALL BERISH
      if (user.isSubscribed === false) {
        user.isSubscribed = true; // Ball berildi deb belgilaymiz

        if (!user.invitedBy && referrerId && referrerId != userId) {
          user.invitedBy = referrerId;
        }

        await user.save();

        // TAKLIF QILGAN ODAMGA BALL BERISH
        if (user.invitedBy) {
          const referrer = await User.findOne({ telegramId: user.invitedBy });

          if (referrer) {
            referrer.balance += STARS_PRICE;
            referrer.totalInvited += 1;
            await referrer.save();

            bot
              .sendMessage(
                user.invitedBy,
                `🌟 Tabriklaymiz! **${firstName}** botni to'liq faollashtirdi.\n\n*Hisobingizga:* + ${STARS_PRICE} ⭐ qo'shildi.`,
                { parse_mode: "Markdown" },
              )
              .catch(() => {});
          }
        }
      }

      // 4. Asosiy start xabari
      const photoPath = path.join(__dirname, "../../public/Stars.png");

      await bot.sendPhoto(chatId, photoPath, {
        caption: `<b>👋 Salom <a href="tg://user?id=${userId}">${firstName}</a>!</b>

✨ Botga xush kelibsiz!
Bu yerda siz do'stlaringizni taklif qilib, STARS ishlashingiz mumkin. 🌟

📌 Qanday boshlashni xohlaysiz?
Boshlash uchun pastdagi menyudan tanlang! 🚀

<i>💡 Eslatma: Do'stlaringizni ko'proq taklif qilsangiz, bonus STARS kutmoqda! 🎁</i>`,
        parse_mode: "HTML",
        ...kb.mainMenyu,
      });
    } catch (err) {
      console.error("Xato:", err);
    }
  };

  // /start buyrug'i
  bot.onText(/\/start\s?(.+)?/, async (msg, match) => {
    const referrerId = match[1] || null;
    await handleStartLogic(msg.chat.id, msg.from, referrerId);
  });

  // "Tekshirish" tugmasi
  bot.on("callback_query", async (query) => {
    if (query.data.startsWith("check_sub")) {
      const chatId = query.message.chat.id;

      await bot.answerCallbackQuery(query.id).catch(() => {});

      const refData = query.data.split("_")[2];
      const referrerId = refData === "none" || !refData ? null : refData;

      await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      await handleStartLogic(chatId, query.from, referrerId);
    }
  });
};
