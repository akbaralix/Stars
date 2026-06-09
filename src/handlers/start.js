const path = require("path");

const kb = require("./keyboard");
const { getUserModel } = require("../../beckend/User");
const Kanal = require("../../beckend/Kanal");
const {
  getSession,
  setSession,
  clearSession,
  getGreeting,
} = require("../runtime/sessionStore");

module.exports = (bot, context, botManager) => {
  const photoPath = path.join(__dirname, "../../public/Stars.png");
  const User = getUserModel(context.botId);

  async function sendPrettyMessage(chatId, text, options = {}) {
    return bot.sendMessage(chatId, text, {
      parse_mode: options.parse_mode || "HTML",
      ...options,
    });
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

  async function ensureSubscriptions(userId, referrerId) {
    const channels = await Kanal.find({ botId: context.botId });
    const missingChannels = [];

    for (const channel of channels) {
      try {
        const member = await bot.getChatMember(channel.kanalId, userId);
        if (member.status === "left" || member.status === "kicked") {
          missingChannels.push([
            {
              text: `📢 ${channel.kanalNomi}`,
              url: `https://t.me/${channel.kanalURL.replace("@", "")}`,
            },
          ]);
        }
      } catch (error) {
        console.log(
          `Kanal tekshirib bo'lmadi ${channel.kanalURL}:`,
          error.message,
        );
      }
    }

    if (missingChannels.length > 0) {
      missingChannels.push([
        {
          text: "✅ Tekshirish",
          callback_data: `check_sub_${referrerId || "none"}`,
        },
      ]);
    }

    return missingChannels;
  }

  async function getOrCreateUser(fromUser, referrerId) {
    const user = await User.findOneAndUpdate(
      { telegramId: fromUser.id },
      {
        $set: {
          firstName: fromUser.first_name,
          username: fromUser.username,
          botId: context.botId,
        },
        $setOnInsert: {
          invitedBy:
            referrerId && Number(referrerId) !== fromUser.id
              ? Number(referrerId)
              : null,
          isSubscribed: false,
        },
      },
      { upsert: true, new: true },
    );

    return user;
  }

  async function applyReferralReward(user, fromUser, referrerId) {
    if (user.isSubscribed) {
      return;
    }

    user.isSubscribed = true;
    if (!user.invitedBy && referrerId && Number(referrerId) !== fromUser.id) {
      user.invitedBy = Number(referrerId);
    }
    await user.save();

    if (!user.invitedBy) {
      return;
    }

    const referrer = await User.findOne({
      telegramId: user.invitedBy,
    });

    if (!referrer) {
      return;
    }

    const runtime = botManager.getRuntime(context.botId);
    const currentStarsPrice =
      Number(runtime?.botDoc?.starsPrice) || Number(context.starsPrice) || 0;

    referrer.balance += currentStarsPrice;
    referrer.totalInvited += 1;
    await referrer.save();

    await bot
      .sendMessage(
        user.invitedBy,
        `🎉 Ajoyib yangilik!\n\n${fromUser.first_name} sizning havolangiz orqali botni to'liq faollashtirdi.\n\n💸 Balansingizga <b>+${currentStarsPrice} ⭐</b> qo'shildi.`,
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  }

  async function sendWelcome(chatId, fromUser) {
    const welcomeText = `<b>🌟 Salom, <a href="tg://user?id=${fromUser.id}">${fromUser.first_name}</a>!</b>

<b>Bu bot orqali siz:</b>

• Do'stlaringizni taklif qilasiz 👥
• Stars yig'asiz 💫
• Sovg'alarga almashtirasiz 🎁

<i>Pastdagi menyudan birini tanlang.</i>`;

    // Rasm bilan yuborilsa, keyinchalik editMessageText xato beradi.
    // Shuning uchun sendMessage dan foydalanamiz yoki editMessageCaption ishlatish kerak.
    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: "HTML",
      ...kb.mainMenu(),
    });
  }

  async function handleStartLogic(chatId, fromUser, referrerId) {
    const isOwner = Number(fromUser.id) === Number(context.ownerId);

    if (isOwner) {
      await sendPrettyMessage(
        chatId,
        `<b>👑 Admin panelga xush kelibsiz!</b>

Bu yerda siz botingizni boshqarishingiz, foydalanuvchilar bilan ishlashingiz va sozlamalarni o'zgartirishingiz mumkin.`,
        {
          ...kb.mainMenu(),
          ...kb.adminKeyboard({
            isSuperAdmin: context.isPrimary,
          }),
        },
      );
      return;
    }

    const missingChannels = await ensureSubscriptions(fromUser.id, referrerId);
    if (missingChannels.length > 0) {
      await sendPrettyMessage(
        chatId,
        `<b>🔐 Botdan foydalanish uchun kichik qadam qoldi</b>

Salom, <b>${fromUser.first_name}</b>!  
Davom etish uchun quyidagi kanallarga obuna bo'lib, so'ng <b>Tekshirish</b> tugmasini bosing.`,
        { reply_markup: { inline_keyboard: missingChannels } },
      );
      return;
    }

    const user = await getOrCreateUser(fromUser, referrerId);
    await applyReferralReward(user, fromUser, referrerId);
    await sendWelcome(chatId, fromUser);
  }

  bot.onText(/\/start\s?(.+)?/, async (msg, match) => {
    try {
      await handleStartLogic(msg.chat.id, msg.from, match[1] || null);
    } catch (error) {
      console.error("Start xatoligi:", error);
    }
  });

  bot.onText(/\/yaratish/, async (msg) => {
    if (!context.isPrimary) {
      return;
    }

    setSession(context.botId, msg.chat.id, {
      step: "waiting_for_new_bot_token",
    });
    await sendPrettyMessage(
      msg.chat.id,
      `<b>🚀 Yangi bot yaratish</b>

Siz hozir o'zingiz uchun alohida <b>Stars ishlovchi bot</b> yaratishingiz mumkin.

<b>Keyingi qadam:</b> menga @BotFather dan botingizni tokenini yuboring.`,
    );
  });

  bot.on("message", async (msg) => {
    try {
      if (!context.isPrimary || !msg.text) return;

      const session = getSession(context.botId, msg.chat.id);
      if (
        !session ||
        session.step !== "waiting_for_new_bot_token" ||
        msg.text.startsWith("/")
      ) {
        return;
      }

      const token = msg.text.trim();
      const result = await botManager.createAndLaunchBot({
        token,
        owner: msg.from,
        starsPrice:
          Number(botManager.getRuntime(context.botId)?.botDoc?.starsPrice) ||
          Number(context.starsPrice) ||
          0,
      });

      clearSession(context.botId, msg.chat.id);

      if (result.exists) {
        await bot.sendMessage(
          msg.chat.id,
          `⚠️ Bu token allaqachon ulangan.\n\nUlangan bot: @${result.botDoc.username}`,
        );
        return;
      }

      if (result.invalid) {
        await bot.sendMessage(
          msg.chat.id,
          "❌ Token noto'g'ri yoki botga ulanib bo'lmadi.\n\nIltimos, tokenni qayta tekshirib yana yuboring.",
        );
        return;
      }

      await sendPrettyMessage(
        msg.chat.id,
        `<b>🎉 Tabriklaymiz!</b>

Yangi bot muvaffaqiyatli ishga tushdi: <b>@${result.botDoc.username}</b>

Endi shu botga kirib, admin menyusi orqali uni boshqarishingiz mumkin.`,
      );
    } catch (error) {
      if (msg && msg.chat) {
        clearSession(context.botId, msg.chat.id);
        console.error("Bot yaratishda xato:", error);
        await bot
          .sendMessage(
            msg.chat.id,
            "⚠️ Bot yaratishda xato yuz berdi.\n\nTokenni tekshirib yana urinib ko'ring.",
          )
          .catch(() => {});
      }
    }
  });
};
