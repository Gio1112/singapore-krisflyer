import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Partials
} from "discord.js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// === CONFIG ===

const MEMBERS_FILE = "/data/krisflyer_members.json";
const SHOP_FILE = "/data/shop_items.json"; 
const ADMIN_ROLE = "Bot Management";
// === SINGAPORE AIRLINES BRANDING ===
const SQ_COLORS = {
  primary: "#00205B",
  gold: "#D4AF37",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
  success: "#00A651",
  error: "#E74C3C"
};

// === EMOJI CONSTANTS ===
const EMOJIS = {
  krisflyer: "<:krisflyer:1440278017900417125>",
  silver: "<:krisflyer_silver:1440278112557469757>",
  gold: "<:krisflyer_gold:1440278049533984808>",
  important: "<:important:1401134115138572388>",
  thumbsdown: "<:thumbsdown:1401135047423164517>",
  thumbsup: "<:thumbsup:1401135050090745887>",
  departure: "<:departure:1401134121320972319>"
};

// === IMAGES ===
const IMAGES = {
  logo: "https://i.imgur.com/YourLogoImage.png", // Replace with actual hosted image URL
  footer: "https://i.imgur.com/YourFooterImage.png" // Replace with actual hosted image URL
};

// === KRISFLYER TIER CONFIGURATION ===
const KRISFLYER_TIERS = [
  { 
    name: 'KrisFlyer', 
    minMiles: 0, 
    maxMiles: 25000,
    role: 'KrisFlyer Member',
    color: SQ_COLORS.primary,
    emoji: EMOJIS.krisflyer,
    benefits: 'Standard accrual • Award redemption • Priority waitlist',
    multiplier: 1.0
  },
  { 
    name: 'Elite Silver', 
    minMiles: 25000, 
    maxMiles: 50000,
    role: 'KrisFlyer Elite Silver',
    color: SQ_COLORS.silver,
    emoji: EMOJIS.silver,
    benefits: 'KrisFlyer benefits • 25% bonus miles • Priority check-in • Extra baggage',
    multiplier: 1.25
  },
  { 
    name: 'Elite Gold', 
    minMiles: 50000, 
    maxMiles: 100000,
    role: 'KrisFlyer Elite Gold',
    color: SQ_COLORS.gold,
    emoji: EMOJIS.gold,
    benefits: 'Elite Silver benefits • 50% bonus miles • Lounge access • Priority boarding',
    multiplier: 1.50
  },
  { 
    name: 'PPS Club', 
    minMiles: 100000, 
    maxMiles: Infinity,
    role: 'KrisFlyer PPS Club',
    color: SQ_COLORS.gold,
    emoji: EMOJIS.gold, // Using Gold for PPS as it's the highest premium tier available in the list
    benefits: 'Elite Gold benefits • 100% bonus miles • Guaranteed award seats • Dedicated hotline',
    multiplier: 2.0
  }
];

// === CLASS MULTIPLIERS ===
const CLASS_MULTIPLIERS = {
  'Economy': 1.0,
  'Premium Economy': 1.15,
  'Business': 1.25,
  'First': 1.50,
  'Suites': 1.75
};

// === SHOP ITEMS ===
let shopItems = fs.existsSync(SHOP_FILE) ? JSON.parse(fs.readFileSync(SHOP_FILE)) : {
  'lounge-pass': {
    name: 'SilverKris Lounge Pass',
    description: 'Single-use lounge access pass',
    cost: 5000,
    emoji: '🎫',
    type: 'consumable'
  },
  'upgrade-voucher': {
    name: 'Upgrade Voucher',
    description: 'One-way cabin upgrade certificate',
    cost: 15000,
    emoji: EMOJIS.departure, // Updated to use Departure/Flight icon
    type: 'consumable'
  },
  'companion-ticket': {
    name: 'Companion Ticket',
    description: 'Bring a companion on award travel',
    cost: 25000,
    emoji: '👥',
    type: 'consumable'
  },
  'priority-boarding': {
    name: 'Priority Boarding Pass',
    description: 'Priority boarding for your next 5 flights',
    cost: 8000,
    emoji: '🎟️',
    type: 'consumable'
  },
  'extra-baggage': {
    name: 'Extra Baggage Allowance',
    description: 'Additional 10kg baggage allowance',
    cost: 6000,
    emoji: '🧳',
    type: 'consumable'
  }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel],
});

// === LOAD DATA ===
let members = fs.existsSync(MEMBERS_FILE) ? JSON.parse(fs.readFileSync(MEMBERS_FILE)) : {};

// === SAVE DATA ===
const saveData = () => {
  fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
  fs.writeFileSync(SHOP_FILE, JSON.stringify(shopItems, null, 2));
};

// === MEMBER FUNCTIONS ===
function getMember(userId) {
  if (!members[userId]) {
    members[userId] = {
      miles: 0,
      lifetimeMiles: 0,
      flightsCompleted: 0,
      tier: 'KrisFlyer',
      joinDate: new Date().toISOString(),
      inventory: {}
    };
    saveData();
  }
  return members[userId];
}

function getTierByMiles(miles) {
  return KRISFLYER_TIERS.find(tier => miles >= tier.minMiles && miles <= tier.maxMiles) || KRISFLYER_TIERS[0];
}

function updateMiles(userId, milesChange) {
  const member = getMember(userId);
  const oldMiles = member.miles;
  const oldTier = getTierByMiles(member.miles);
  
  member.miles += milesChange;
  if (milesChange > 0) {
    member.lifetimeMiles += milesChange;
  }
  
  const newTier = getTierByMiles(member.miles);
  member.tier = newTier.name;
  
  members[userId] = member;
  saveData();
  
  return {
    member,
    oldMiles,
    oldTier,
    newTier,
    tierChanged: oldTier.name !== newTier.name
  };
}

function calculateMiles(baseMiles, cabinClass, hasMemberBonus = false) {
  let multiplier = CLASS_MULTIPLIERS[cabinClass] || 1.0;
  
  if (hasMemberBonus) {
    multiplier *= 1.25; // KrisFlyer bonus multiplier
  }
  
  return Math.round(baseMiles * multiplier);
}

function getProgressToNextTier(miles) {
  const currentTier = getTierByMiles(miles);
  const currentTierIndex = KRISFLYER_TIERS.indexOf(currentTier);
  
  if (currentTierIndex === KRISFLYER_TIERS.length - 1) {
    return { isMaxTier: true, progress: 100, milesNeeded: 0 };
  }
  
  const nextTier = KRISFLYER_TIERS[currentTierIndex + 1];
  const milesInCurrentTier = miles - currentTier.minMiles;
  const milesNeededForNextTier = nextTier.minMiles - currentTier.minMiles;
  const progress = Math.floor((milesInCurrentTier / milesNeededForNextTier) * 100);
  const milesNeeded = nextTier.minMiles - miles;
  
  return { isMaxTier: false, progress, milesNeeded, nextTier };
}

function createProgressBar(percentage, length = 20) {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}

async function updateMemberRoles(guild, userId, newTierName) {
  try {
    const member = await guild.members.fetch(userId);
    if (!member) return;

    const tierRoles = KRISFLYER_TIERS.map(t => t.role);
    const currentTierRoles = member.roles.cache.filter(role =>
      tierRoles.includes(role.name)
    );

    for (const role of currentTierRoles.values()) {
      await member.roles.remove(role);
    }

    const newTier = KRISFLYER_TIERS.find(t => t.name === newTierName);
    if (newTier) {
      const roleToAdd = guild.roles.cache.find(r => r.name === newTier.role);
      if (roleToAdd) {
        await member.roles.add(roleToAdd);
      }
    }
  } catch (error) {
    console.error("Error updating member roles:", error);
  }
}

function hasAdminRole(member) {
  return member.roles.cache.some(r => r.name.toLowerCase() === ADMIN_ROLE.toLowerCase());
}

// === REGISTER COMMANDS ===
const commands = [
  new SlashCommandBuilder()
    .setName("krisflyer")
    .setDescription("View your KrisFlyer account"),

  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check KrisFlyer miles for a member")
    .addUserOption(o => o.setName("user").setDescription("User to check (leave empty for yourself)").setRequired(false)),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the KrisFlyer leaderboard")
    .addIntegerOption(o => o.setName("page").setDescription("Page number (default: 1)").setRequired(false)),

  new SlashCommandBuilder()
    .setName("tiers")
    .setDescription("View information about KrisFlyer membership tiers"),

  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Browse the KrisFlyer Rewards Shop"),

  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("View your purchased items"),

  new SlashCommandBuilder()
    .setName("calculate")
    .setDescription("Calculate miles for a flight")
    .addIntegerOption(o => o.setName("base_miles").setDescription("Base miles for the flight").setRequired(true))
    .addStringOption(o => o.setName("cabin").setDescription("Cabin class").setRequired(true)
      .addChoices(
        { name: 'Economy', value: 'Economy' },
        { name: 'Premium Economy', value: 'Premium Economy' },
        { name: 'Business', value: 'Business' },
        { name: 'First', value: 'First' },
        { name: 'Suites', value: 'Suites' }
      ))
    .addBooleanOption(o => o.setName("bonus").setDescription("Include KrisFlyer bonus multiplier (1.25x)?").setRequired(false)),

  // === ADMIN COMMANDS ===
  new SlashCommandBuilder()
    .setName("awardmiles")
    .setDescription("Award miles to a member (Admin only)")
    .addUserOption(o => o.setName("user").setDescription("User to award miles to").setRequired(true))
    .addIntegerOption(o => o.setName("miles").setDescription("Amount of miles to award").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for awarding miles").setRequired(false))
    .addBooleanOption(o => o.setName("flight_completion").setDescription("Is this for completing a flight?").setRequired(false)),

  new SlashCommandBuilder()
    .setName("removemiles")
    .setDescription("Remove miles from a member (Admin only)")
    .addUserOption(o => o.setName("user").setDescription("User to remove miles from").setRequired(true))
    .addIntegerOption(o => o.setName("miles").setDescription("Amount of miles to remove").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for removing miles").setRequired(false)),

  new SlashCommandBuilder()
    .setName("setmiles")
    .setDescription("Set a member's miles to a specific amount (Admin only)")
    .addUserOption(o => o.setName("user").setDescription("User to modify").setRequired(true))
    .addIntegerOption(o => o.setName("miles").setDescription("New miles amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("additem")
    .setDescription("Add an item to the shop (Admin only)")
    .addStringOption(o => o.setName("id").setDescription("Item ID (no spaces)").setRequired(true))
    .addStringOption(o => o.setName("name").setDescription("Item name").setRequired(true))
    .addIntegerOption(o => o.setName("cost").setDescription("Miles cost").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Item description").setRequired(true))
    .addStringOption(o => o.setName("emoji").setDescription("Item emoji").setRequired(false)),
];

// === DEPLOY COMMANDS ===
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log("🔄 Registering commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log("✅ Commands registered successfully");
  } catch (err) {
    console.error("❌ Command registration failed:", err);
  }
})();

// === MAIN HANDLER ===
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName, options, member } = interaction;

    // ===== KRISFLYER ACCOUNT =====
    if (commandName === "krisflyer") {
      await interaction.deferReply();
      
      const memberData = getMember(interaction.user.id);
      const tier = getTierByMiles(memberData.miles);
      const progress = getProgressToNextTier(memberData.miles);

      // Top embed with logo
      const logoEmbed = new EmbedBuilder()
        .setColor(tier.color)
        .setImage(IMAGES.logo);

      // Main info embed
      const infoEmbed = new EmbedBuilder()
        .setColor(tier.color)
        .setAuthor({ 
          name: interaction.user.username,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTitle(`${tier.emoji} KrisFlyer Account`)
        .setDescription(`Welcome to your **KrisFlyer** membership account.\n\nFly with Singapore Airlines to earn miles and enjoy exclusive benefits!`)
        .addFields(
          { 
            name: `${tier.emoji} Current Tier`, 
            value: `**${tier.name}**\n${tier.benefits}`,
            inline: false
          },
          { 
            name: `${EMOJIS.krisflyer} Total Miles`, 
            value: `\`\`\`${memberData.miles.toLocaleString()}\`\`\``,
            inline: true
          },
          { 
            name: `${EMOJIS.important} Lifetime Miles`, 
            value: `\`\`\`${memberData.lifetimeMiles.toLocaleString()}\`\`\``,
            inline: true
          },
          { 
            name: `${EMOJIS.departure} Flights Completed`, 
            value: `\`\`\`${memberData.flightsCompleted}\`\`\``,
            inline: true
          },
          { 
            name: "📅 Member Since", 
            value: `<t:${Math.floor(new Date(memberData.joinDate).getTime() / 1000)}:D>`,
            inline: true
          },
          {
            name: "🔢 Tier Multiplier",
            value: `\`\`\`${tier.multiplier}x\`\`\``,
            inline: true
          }
        );

      if (!progress.isMaxTier) {
        const percentage = Math.round(((memberData.miles - tier.minMiles) / (progress.nextTier.minMiles - tier.minMiles)) * 100);
        const progressBar = createProgressBar(percentage, 20);
        infoEmbed.addFields({
          name: "📊 Progress to Next Tier",
          value: `\`${progressBar}\` ${percentage}%\n**${progress.milesNeeded.toLocaleString()}** miles until **${progress.nextTier.emoji} ${progress.nextTier.name}**`,
          inline: false
        });
      } else {
        infoEmbed.addFields({
          name: `${EMOJIS.important} Achievement`,
          value: "**Maximum tier achieved!**",
          inline: false
        });
      }

      infoEmbed.setFooter({ 
        text: "Singapore Airlines • A Star Alliance Member"
      })
      .setImage(IMAGES.footer)
      .setTimestamp();
      await interaction.editReply({ embeds: [logoEmbed, infoEmbed] });
    }

    // ===== BALANCE =====
    if (commandName === "balance") {
      await interaction.deferReply();
      
      const targetUser = options.getUser("user") || interaction.user;
      const memberData = getMember(targetUser.id);
      const tier = getTierByMiles(memberData.miles);
      const progress = getProgressToNextTier(memberData.miles);

      const logoEmbed = new EmbedBuilder()
        .setColor(tier.color)
        .setImage(IMAGES.logo);
      
      const infoEmbed = new EmbedBuilder()
        .setColor(tier.color)
        .setTitle(`${EMOJIS.krisflyer} KrisFlyer Balance`)
        .setDescription(`Miles information for **${targetUser.username}**`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { 
            name: `${EMOJIS.krisflyer} Miles`, 
            value: `\`\`\`${memberData.miles.toLocaleString()}\`\`\``,
            inline: true
          },
          { 
            name: `${tier.emoji} Tier`, 
            value: `\`\`\`${tier.name}\`\`\``,
            inline: true
          },
          { 
            name: `${EMOJIS.departure} Flights`, 
            value: `\`\`\`${memberData.flightsCompleted}\`\`\``,
            inline: true
          }
        );

      if (!progress.isMaxTier) {
        const percentage = Math.round(((memberData.miles - tier.minMiles) / (progress.nextTier.minMiles - tier.minMiles)) * 100);
        const progressBar = createProgressBar(percentage, 15);
        infoEmbed.addFields({
          name: "📊 Next Tier Progress",
          value: `\`${progressBar}\` ${percentage}%\n**${progress.milesNeeded.toLocaleString()}** miles needed for **${progress.nextTier.emoji} ${progress.nextTier.name}**`,
          inline: false
        });
      } else {
        infoEmbed.addFields({
          name: `${EMOJIS.important} Achievement`,
          value: "Maximum tier unlocked",
          inline: false
        });
      }

      infoEmbed.setFooter({ 
        text: "Singapore Airlines • A Star Alliance Member"
      })
      .setImage(IMAGES.footer)
      .setTimestamp();

      await interaction.editReply({ embeds: [logoEmbed, infoEmbed] });
    }

    // ===== LEADERBOARD =====
    if (commandName === "leaderboard") {
      await interaction.deferReply();

      const page = options.getInteger("page") || 1;
      const perPage = 10;

      const sortedMembers = Object.entries(members)
        .sort((a, b) => b[1].miles - a[1].miles);

      if (sortedMembers.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setColor(SQ_COLORS.primary)
          .setTitle(`${EMOJIS.krisflyer} KrisFlyer Leaderboard`)
          .setDescription("No members have joined KrisFlyer yet!")
          .setFooter({ 
            text: "Fly with Singapore Airlines to earn miles!"
          })
          .setImage(IMAGES.footer);
        return interaction.editReply({ embeds: [emptyEmbed] });
      }

      const totalPages = Math.ceil(sortedMembers.length / perPage);
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const pageMembers = sortedMembers.slice(startIndex, endIndex);

      const logoEmbed = new EmbedBuilder()
        .setColor(SQ_COLORS.primary)
        .setImage(IMAGES.logo);

      const leaderboardEmbed = new EmbedBuilder()
        .setColor(SQ_COLORS.primary)
        .setTitle(`${EMOJIS.important} KrisFlyer Leaderboard`)
        .setDescription(`Top members ranked by miles • Page ${page}/${totalPages}`)
        .setTimestamp();

      for (let i = 0; i < pageMembers.length; i++) {
        const [userId, data] = pageMembers[i];
        const rank = startIndex + i + 1;
        const tier = getTierByMiles(data.miles);

        let medal = '';
        if (rank === 1) medal = EMOJIS.gold;
        else if (rank === 2) medal = EMOJIS.silver;
        else if (rank === 3) medal = EMOJIS.krisflyer; // Bronze equivalent/Standard
        else medal = `**#${rank}**`;

        try {
          const user = await client.users.fetch(userId);
          leaderboardEmbed.addFields({
            name: `${medal} ${user.username}`,
            value: `${tier.emoji} ${tier.name} • **${data.miles.toLocaleString()}** miles • ${data.flightsCompleted} flights`,
            inline: false
          });
        } catch (error) {
          leaderboardEmbed.addFields({
            name: `${medal} Unknown User`,
            value: `${tier.emoji} ${tier.name} • **${data.miles.toLocaleString()}** miles • ${data.flightsCompleted} flights`,
            inline: false
          });
        }
      }

      leaderboardEmbed.setFooter({ 
        text: `Page ${page} of ${totalPages} • Singapore Airlines`
      })
      .setImage(IMAGES.footer);

      await interaction.editReply({ embeds: [logoEmbed, leaderboardEmbed] });
    }

    // ===== TIERS INFO =====
    if (commandName === "tiers") {
      await interaction.deferReply();

      const logoEmbed = new EmbedBuilder()
        .setColor(SQ_COLORS.primary)
        .setImage(IMAGES.logo);

      const tiersEmbed = new EmbedBuilder()
        .setColor(SQ_COLORS.primary)
        .setTitle(`${EMOJIS.departure} KrisFlyer Membership Tiers`)
        .setDescription("Earn miles by flying with Singapore Airlines and Star Alliance partners. Unlock exclusive benefits as you climb through the tiers!\n\n**Each tier provides a multiplier bonus on earned miles**")
        .setTimestamp();

      KRISFLYER_TIERS.forEach(tier => {
        const rangeText = tier.maxMiles === Infinity 
          ? `${tier.minMiles.toLocaleString()}+ miles`
          : `${tier.minMiles.toLocaleString()} - ${tier.maxMiles.toLocaleString()} miles`;

        tiersEmbed.addFields({
          name: `${tier.emoji} ${tier.name}`,
          value: `**Range:** ${rangeText}\n**Multiplier:** ${tier.multiplier}x\n**Benefits:** ${tier.benefits}\n**Role:** ${tier.role}`,
          inline: false
        });
      });

      tiersEmbed.setFooter({ 
        text: "Singapore Airlines • Fly the world's best airline"
      })
      .setImage(IMAGES.footer);
      await interaction.editReply({ embeds: [logoEmbed, tiersEmbed] });
    }

    // ===== SHOP =====
    if (commandName === "shop") {
      await interaction.deferReply();

      const logoEmbed = new EmbedBuilder()
        .setColor(SQ_COLORS.primary)
        .setImage(IMAGES.logo);

      const shopEmbed = new EmbedBuilder()
        .setColor(SQ_COLORS.primary)
        .setTitle(`${EMOJIS.krisflyer} KrisFlyer Rewards Shop`)
        .setDescription("Redeem your miles for exclusive rewards and upgrades!")
        .setTimestamp();

      const itemEntries = Object.entries(shopItems);
      
      if (itemEntries.length === 0) {
        shopEmbed.addFields({ name: "No Items", value: "The shop is currently empty. Check back later!" });
      } else {
        itemEntries.forEach(([id, item]) => {
          shopEmbed.addFields({
            name: `${item.emoji || '🎁'} ${item.name}`,
            value: `${item.description}\n**Cost:** ${item.cost.toLocaleString()} miles\n**ID:** \`${id}\``,
            inline: false
          });
        });
      }

      shopEmbed.setFooter({ 
        text: "Use /buy <item_id> to purchase • Singapore Airlines"
      })
      .setImage(IMAGES.footer);
      // Add buy button/select menu
      const itemIds = Object.keys(shopItems);
      if (itemIds.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("shop_buy")
          .setPlaceholder("🛒 Select an item to purchase")
          .addOptions(
            itemIds.map(id => {
              const item = shopItems[id];
              return {
                label: item.name,
                description: `${item.cost.toLocaleString()} miles`,
                value: id,
                emoji: item.emoji || '🎁'
              };
            })
          );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.editReply({ embeds: [logoEmbed, shopEmbed], components: [row] });
      } else {
        await interaction.editReply({ embeds: [logoEmbed, shopEmbed] });
      }
    }

    // ===== INVENTORY =====
    if (commandName === "inventory") {
      await interaction.deferReply();

      const memberData = getMember(interaction.user.id);
      
      const logoEmbed = new EmbedBuilder()
        .setColor(SQ_COLORS.primary)
        .setImage(IMAGES.logo);

      const inventoryEmbed = new EmbedBuilder()
        .setColor(SQ_COLORS.primary)
        .setTitle("🎒 Your Inventory")
        .setDescription("Items you've redeemed with your KrisFlyer miles")
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

      if (Object.keys(memberData.inventory).length === 0) {
        inventoryEmbed.addFields({ 
          name: "Empty Inventory", 
          value: "You haven't purchased any items yet.\nVisit `/shop` to browse available rewards!" 
        });
      } else {
        Object.entries(memberData.inventory).forEach(([itemId, quantity]) => {
          const item = shopItems[itemId];
          if (item) {
            inventoryEmbed.addFields({
              name: `${item.emoji || '🎁'} ${item.name}`,
              value: `**Quantity:** ${quantity}\n${item.description}`,
              inline: true
            });
          }
        });
      }

      inventoryEmbed.setFooter({ 
        text: "Singapore Airlines • A Star Alliance Member"
      })
      .setImage(IMAGES.footer);
      await interaction.editReply({ embeds: [logoEmbed, inventoryEmbed] });
    }

    // ===== CALCULATE MILES =====
    if (commandName === "calculate") {
      await interaction.deferReply();

      const baseMiles = options.getInteger("base_miles");
      const cabin = options.getString("cabin");
      const hasBonus = options.getBoolean("bonus") || false;

      const calculatedMiles = calculateMiles(baseMiles, cabin, hasBonus);
      const cabinMultiplier = CLASS_MULTIPLIERS[cabin];
      const bonusMultiplier = hasBonus ? 1.25 : 1.0;
      const totalMultiplier = cabinMultiplier * bonusMultiplier;

      const logoEmbed = new EmbedBuilder()
        .setColor(SQ_COLORS.primary)
        .setImage(IMAGES.logo);

      const calcEmbed = new EmbedBuilder()
        .setColor(SQ_COLORS.success)
        .setTitle("🧮 Miles Calculator")
        .setDescription("Miles calculation for your flight")
        .addFields(
          { name: "Base Miles", value: `${baseMiles.toLocaleString()}`, inline: true },
          { name: "Cabin Class", value: cabin, inline: true },
          { name: "KrisFlyer Bonus", value: hasBonus ? "Yes (1.25x)" : "No", inline: true },
          { name: "Cabin Multiplier", value: `${cabinMultiplier}x`, inline: true },
          { name: "Total Multiplier", value: `${totalMultiplier}x`, inline: true },
          { name: `${EMOJIS.krisflyer} Total Miles Earned`, value: `**${calculatedMiles.toLocaleString()}** miles`, inline: true }
        )
        .setFooter({ 
          text: "Singapore Airlines • Miles subject to booking class"
        })
        .setImage(IMAGES.footer)
        .setTimestamp();
      await interaction.editReply({ embeds: [logoEmbed, calcEmbed] });
    }

    // ===== AWARD MILES (ADMIN) =====
    if (commandName === "awardmiles") {
      if (!hasAdminRole(member)) {
        const denyEmbed = new EmbedBuilder()
          .setColor(SQ_COLORS.error)
          .setTitle(`${EMOJIS.thumbsdown} Access Denied`)
          .setDescription(`You need the **${ADMIN_ROLE}** role to use this command.`)
          .setFooter({ text: "Singapore Airlines" });
        return interaction.reply({ embeds: [denyEmbed], flags: 64 });
      }

      await interaction.deferReply();

      const targetUser = options.getUser("user");
      const milesToAdd = options.getInteger("miles");
      const reason = options.getString("reason");
      const isFlightCompletion = options.getBoolean("flight_completion") || false;

      const memberData = getMember(targetUser.id);
      
      if (isFlightCompletion) {
        memberData.flightsCompleted += 1;
      }

      const result = updateMiles(targetUser.id, milesToAdd, reason);

      if (result.tierChanged && interaction.guild) {
        await updateMemberRoles(interaction.guild, targetUser.id, result.newTier.name);
      }

      const embed = new EmbedBuilder()
        .setColor(SQ_COLORS.success)
        .setTitle(`${EMOJIS.thumbsup} Miles Awarded`)
        .setDescription(`Successfully awarded **${milesToAdd.toLocaleString()}** miles to **${targetUser.username}**`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: "Previous Balance", value: `${result.oldMiles.toLocaleString()} miles`, inline: true },
          { name: "New Balance", value: `${result.member.miles.toLocaleString()} miles`, inline: true },
          { name: "Amount Added", value: `+${milesToAdd.toLocaleString()}`, inline: true }
        );

      if (isFlightCompletion) {
        embed.addFields(
          { name: `${EMOJIS.departure} Flight Completed`, value: reason || 'Yes', inline: true },
          { name: "📊 Total Flights", value: `${result.member.flightsCompleted}`, inline: true }
        );
      } else if (reason) {
        embed.addFields({ name: "📝 Reason", value: reason, inline: false });
      }

      if (result.tierChanged) {
        embed.addFields({
          name: `${EMOJIS.important} Tier Upgrade!`,
          value: `${result.oldTier.emoji} ${result.oldTier.name} → ${result.newTier.emoji} ${result.newTier.name}`,
          inline: false
        });
        embed.setColor(result.newTier.color);
      }

      embed.addFields({ name: "👤 Awarded By", value: member.displayName, inline: false });
      embed.setFooter({ 
        text: "Singapore Airlines • KrisFlyer"
      })
      .setImage(IMAGES.footer)
      .setTimestamp();
      await interaction.editReply({ embeds: [embed] });

      // Send DM to user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(result.tierChanged ? result.newTier.color : SQ_COLORS.success)
          .setTitle(`${EMOJIS.krisflyer} Miles Awarded!`)
          .setDescription(`You've been awarded **${milesToAdd.toLocaleString()}** KrisFlyer miles!`)
          .addFields(
            { name: "New Balance", value: `${result.member.miles.toLocaleString()} miles`, inline: true },
            { name: "New Tier", value: `${result.newTier.emoji} ${result.newTier.name}`, inline: true }
          );

        if (result.tierChanged) {
          dmEmbed.addFields({
            name: `${EMOJIS.important} Congratulations!`,
            value: `You've been upgraded to **${result.newTier.name}**!\n\n${result.newTier.benefits}`,
            inline: false
          });
        }

        if (reason) {
          dmEmbed.addFields({ name: "Reason", value: reason, inline: false });
        }

        dmEmbed.setFooter({ text: "Singapore Airlines • KrisFlyer" });
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.log("Could not DM user");
      }
    }

    // ===== REMOVE MILES (ADMIN) =====
    if (commandName === "removemiles") {
      if (!hasAdminRole(member)) {
        const denyEmbed = new EmbedBuilder()
          .setColor(SQ_COLORS.error)
          .setTitle(`${EMOJIS.thumbsdown} Access Denied`)
          .setDescription(`You need the **${ADMIN_ROLE}** role to use this command.`)
          .setFooter({ text: "Singapore Airlines" });
        return interaction.reply({ embeds: [denyEmbed], flags: 64 });
      }

      await interaction.deferReply();

      const targetUser = options.getUser("user");
      const milesToRemove = options.getInteger("miles");
      const reason = options.getString("reason");

      const result = updateMiles(targetUser.id, -milesToRemove, reason);

      if (result.tierChanged && interaction.guild) {
        await updateMemberRoles(interaction.guild, targetUser.id, result.newTier.name);
      }

      const embed = new EmbedBuilder()
        .setColor(SQ_COLORS.error)
        .setTitle(`${EMOJIS.thumbsdown} Miles Removed`)
        .setDescription(`Removed **${milesToRemove.toLocaleString()}** miles from **${targetUser.username}**`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: "Previous Balance", value: `${result.oldMiles.toLocaleString()} miles`, inline: true },
          { name: "New Balance", value: `${result.member.miles.toLocaleString()} miles`, inline: true },
          { name: "Amount Removed", value: `-${milesToRemove.toLocaleString()}`, inline: true }
        );

      if (reason) {
        embed.addFields({ name: "📝 Reason", value: reason, inline: false });
      }

      if (result.tierChanged) {
        embed.addFields({
          name: "⬇️ Tier Changed",
          value: `${result.oldTier.emoji} ${result.oldTier.name} → ${result.newTier.emoji} ${result.newTier.name}`,
          inline: false
        });
      }

      embed.addFields({ name: "👤 Removed By", value: member.displayName, inline: false });
      embed.setFooter({ 
        text: "Singapore Airlines • KrisFlyer"
      })
      .setImage(IMAGES.footer)
      .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }

    // ===== SET MILES (ADMIN) =====
    if (commandName === "setmiles") {
      if (!hasAdminRole(member)) {
        const denyEmbed = new EmbedBuilder()
          .setColor(SQ_COLORS.error)
          .setTitle(`${EMOJIS.thumbsdown} Access Denied`)
          .setDescription(`You need the **${ADMIN_ROLE}** role to use this command.`)
          .setFooter({ text: "Singapore Airlines" });
        return interaction.reply({ embeds: [denyEmbed], flags: 64 });
      }

      await interaction.deferReply();

      const targetUser = options.getUser("user");
      const newMiles = options.getInteger("miles");

      const memberData = getMember(targetUser.id);
      const oldMiles = memberData.miles;
      const oldTier = getTierByMiles(memberData.miles);

      memberData.miles = newMiles;
      const newTier = getTierByMiles(newMiles);
      memberData.tier = newTier.name;
      members[targetUser.id] = memberData;
      saveData();

      const tierChanged = oldTier.name !== newTier.name;
      if (tierChanged && interaction.guild) {
        await updateMemberRoles(interaction.guild, targetUser.id, newTier.name);
      }

      const embed = new EmbedBuilder()
        .setColor(SQ_COLORS.success)
        .setTitle(`${EMOJIS.thumbsup} Miles Updated`)
        .setDescription(`Set miles for **${targetUser.username}**`)
        .addFields(
          { name: "Previous Balance", value: `${oldMiles.toLocaleString()} miles`, inline: true },
          { name: "New Balance", value: `${newMiles.toLocaleString()} miles`, inline: true }
        );

      if (tierChanged) {
        embed.addFields({
          name: `${EMOJIS.important} Tier Update`,
          value: `${oldTier.emoji} ${oldTier.name} → ${newTier.emoji} ${newTier.name}`,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    }

    // ===== ADD ITEM (ADMIN) =====
    if (commandName === "additem") {
      if (!hasAdminRole(member)) {
        const denyEmbed = new EmbedBuilder()
          .setColor(SQ_COLORS.error)
          .setTitle(`${EMOJIS.thumbsdown} Access Denied`)
          .setDescription(`You need the **${ADMIN_ROLE}** role to use this command.`)
          .setFooter({ text: "Singapore Airlines" });
        return interaction.reply({ embeds: [denyEmbed], flags: 64 });
      }

      const id = options.getString("id");
      const name = options.getString("name");
      const cost = options.getInteger("cost");
      const description = options.getString("description");
      const emoji = options.getString("emoji") || '🎁';

      shopItems[id] = {
        name,
        cost,
        description,
        emoji,
        type: 'consumable'
      };
      saveData();

      const embed = new EmbedBuilder()
        .setColor(SQ_COLORS.success)
        .setTitle(`${EMOJIS.thumbsup} Item Added`)
        .setDescription(`Successfully added **${name}** to the shop!`)
        .addFields(
          { name: "ID", value: id, inline: true },
          { name: "Cost", value: `${cost.toLocaleString()} miles`, inline: true },
          { name: "Emoji", value: emoji, inline: true }
        );

      await interaction.reply({ embeds: [embed] });
    }
  }

  // ===== BUTTON / MENU HANDLING =====
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "shop_buy") {
      await interaction.deferReply({ ephemeral: true });

      const itemId = interaction.values[0];
      const item = shopItems[itemId];
      
      if (!item) {
        return interaction.editReply({ content: `${EMOJIS.thumbsdown} Item no longer exists.` });
      }

      const memberData = getMember(interaction.user.id);
      
      if (memberData.miles < item.cost) {
        return interaction.editReply({ 
          content: `${EMOJIS.thumbsdown} **Insufficient miles!**\nYou need **${(item.cost - memberData.miles).toLocaleString()}** more miles to purchase this item.` 
        });
      }

      // Process purchase
      memberData.miles -= item.cost;
      memberData.inventory[itemId] = (memberData.inventory[itemId] || 0) + 1;
      
      // Update tier if miles drop below current threshold? 
      // Usually loyalty programs calculate tier based on earned/lifetime miles, not current spendable balance.
      // This implementation keeps the tier even if spendable miles drop, which is standard for airlines.
      
      saveData();

      const embed = new EmbedBuilder()
        .setColor(SQ_COLORS.success)
        .setTitle(`${EMOJIS.thumbsup} Purchase Successful`)
        .setDescription(`You purchased **${item.name}** for **${item.cost.toLocaleString()}** miles.`)
        .addFields(
          { name: "Remaining Balance", value: `${memberData.miles.toLocaleString()} miles`, inline: true },
          { name: "Item", value: `${item.emoji || '🎁'} ${item.name}`, inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);