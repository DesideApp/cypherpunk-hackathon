import User from "#modules/users/models/user.model.js";
import Contact from "#modules/contacts/models/contact.model.js";

export async function findUserByPubkey(req, res) {
  try {
    const { pubkey } = req.params;
    const requesterPubkey = req.user?.wallet;

    if (!pubkey) {
      return res.status(400).json({ error: "MISSING_PUBKEY", nextStep: "CHECK_INPUT" });
    }

    const user = await User.findOne({ wallet: pubkey }).lean();

    if (!user) {
      return res.status(200).json({ registered: false });
    }

    let relationship = "none";
    let blocked = false;

    if (requesterPubkey) {
      const contact = await Contact.findOne({
        owner: requesterPubkey,
        contact: pubkey,
      }).lean();

      if (contact) {
        relationship = contact.status;
        blocked = contact.blocked || false;
      }
    }

    return res.status(200).json({
      registered: true,
      pubkey: user.wallet,
      relationship,
      blocked,
      nickname: user.nickname || null,
      avatar: user.avatar || null,
      social: {
        x: user.social?.x || null,
        website: user.social?.website || null,
      },
    });
  } catch (error) {
    console.error("❌ Error checking user:", error);
    return res.status(500).json({
      error: "USER_LOOKUP_FAILED",
      nextStep: "RETRY",
    });
  }
}
