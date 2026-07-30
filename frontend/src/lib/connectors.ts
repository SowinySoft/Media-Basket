"use client";

import { ReactNode } from "react";
import { Youtube, MessageCircle, Phone, Send, Image, Twitter, Facebook, Briefcase, Video, ExternalLink, Copy, CheckCircle, Gamepad2, Slack, Globe } from "lucide-react";

export interface ConnectorConfig {
  type: string;
  name: string;
  icon: any;
  color: string;
  description: string;
  setupUrl?: string;
  steps: {
    id: string;
    title: string;
    description: string;
    fields: {
      key: string;
      label: string;
      placeholder: string;
      type?: "text" | "password" | "url";
      help?: string;
    }[];
    instructions?: string[];
  }[];
}

export const CONNECTOR_CONFIGS: Record<string, ConnectorConfig> = {
  youtube: {
    type: "youtube",
    name: "YouTube",
    icon: Youtube,
    color: "text-red-500",
    description: "Connect your YouTube channel to manage videos, comments, and analytics.",
    setupUrl: "https://console.cloud.google.com/",
    steps: [
      {
        id: "welcome",
        title: "Connect YouTube",
        description: "Authorize access to your YouTube account",
        fields: [],
        instructions: [
          "Click 'Next' to be redirected to Google",
          "Sign in with your Google account",
          "Grant access to YouTube",
          "You'll be redirected back automatically",
        ],
      },
    ],
  },
  reddit: {
    type: "reddit",
    name: "Reddit",
    icon: MessageCircle,
    color: "text-orange-500",
    description: "Connect your Reddit account to manage posts, comments, and moderation.",
    setupUrl: "https://www.reddit.com/prefs/apps",
    steps: [
      {
        id: "welcome",
        title: "Connect Reddit",
        description: "Authorize access to your Reddit account",
        fields: [],
        instructions: [
          "Click 'Next' to be redirected to Reddit",
          "Log in with your Reddit account",
          "Authorize the application",
          "You'll be redirected back automatically",
        ],
      },
    ],
  },
  whatsapp: {
    type: "whatsapp",
    name: "WhatsApp Business",
    icon: Phone,
    color: "text-green-500",
    description: "Connect WhatsApp Business API to send and receive messages.",
    setupUrl: "https://developers.facebook.com/",
    steps: [
      {
        id: "app_id",
        title: "Facebook App ID",
        description: "Enter your Facebook App ID from the developer dashboard",
        fields: [
          { key: "app_id", label: "App ID", placeholder: "123456789", help: "Found in App Settings > Basic" },
        ],
      },
      {
        id: "app_secret",
        title: "Facebook App Secret",
        description: "Enter your Facebook App Secret",
        fields: [
          { key: "app_secret", label: "App Secret", type: "password", placeholder: "abcdef123456", help: "Found in App Settings > Basic" },
        ],
      },
      {
        id: "phone_number_id",
        title: "Phone Number ID",
        description: "Enter your WhatsApp Phone Number ID",
        fields: [
          { key: "phone_number_id", label: "Phone Number ID", placeholder: "1234567890", help: "Found in WhatsApp > API Setup" },
        ],
      },
      {
        id: "access_token",
        title: "Access Token",
        description: "Enter your permanent access token",
        fields: [
          { key: "access_token", label: "Access Token", type: "password", placeholder: "EAA...", help: "Generate in WhatsApp > API Setup" },
        ],
      },
      {
        id: "verify",
        title: "Verify Connection",
        description: "We'll send a test message to verify the connection",
        fields: [
          { key: "phone_number", label: "Your Phone Number", placeholder: "+1234567890", help: "Phone number to receive test message" },
        ],
      },
    ],
  },
  telegram: {
    type: "telegram",
    name: "Telegram",
    icon: Send,
    color: "text-blue-400",
    description: "Connect a Telegram bot to send and receive messages.",
    setupUrl: "https://t.me/BotFather",
    steps: [
      {
        id: "create_bot",
        title: "Create a Telegram Bot",
        description: "Create a bot using BotFather",
        fields: [],
        instructions: [
          "Open Telegram and search for @BotFather",
          "Send /newbot command",
          "Choose a name for your bot",
          "Choose a username (must end with 'bot')",
          "Copy the bot token",
        ],
      },
      {
        id: "bot_token",
        title: "Bot Token",
        description: "Enter your Telegram bot token",
        fields: [
          { key: "bot_token", label: "Bot Token", placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11", help: "Get from @BotFather" },
        ],
      },
    ],
  },
  instagram: {
    type: "instagram",
    name: "Instagram",
    icon: Image,
    color: "text-pink-500",
    description: "Connect Instagram to manage posts, comments, and analytics.",
    setupUrl: "https://developers.facebook.com/",
    steps: [
      {
        id: "welcome",
        title: "Connect Instagram",
        description: "Authorize access via Facebook",
        fields: [],
        instructions: [
          "Instagram uses Facebook OAuth",
          "Click 'Next' to authorize with Facebook",
          "Grant Instagram permissions",
          "You'll be redirected back automatically",
        ],
      },
    ],
  },
  twitter: {
    type: "twitter",
    name: "Twitter/X",
    icon: Twitter,
    color: "text-sky-500",
    description: "Connect Twitter/X to manage tweets, mentions, and replies.",
    setupUrl: "https://developer.twitter.com/",
    steps: [
      {
        id: "welcome",
        title: "Connect Twitter/X",
        description: "Authorize access to your Twitter account",
        fields: [],
        instructions: [
          "Click 'Next' to be redirected to Twitter",
          "Log in with your Twitter account",
          "Authorize the application",
          "You'll be redirected back automatically",
        ],
      },
    ],
  },
  facebook: {
    type: "facebook",
    name: "Facebook",
    icon: Facebook,
    color: "text-blue-600",
    description: "Connect your Facebook page to manage posts, comments, and engagement.",
    setupUrl: "https://developers.facebook.com/",
    steps: [
      {
        id: "welcome",
        title: "Connect Facebook",
        description: "Authorize access to your Facebook page",
        fields: [],
        instructions: [
          "Click 'Next' to be redirected to Facebook",
          "Log in with your Facebook account",
          "Grant access to your pages",
          "You'll be redirected back automatically",
        ],
      },
    ],
  },
  linkedin: {
    type: "linkedin",
    name: "LinkedIn",
    icon: Briefcase,
    color: "text-blue-700",
    description: "Connect LinkedIn to manage posts, comments, and professional network.",
    setupUrl: "https://www.linkedin.com/developers/",
    steps: [
      {
        id: "welcome",
        title: "Connect LinkedIn",
        description: "Authorize access to your LinkedIn account",
        fields: [],
        instructions: [
          "Click 'Next' to be redirected to LinkedIn",
          "Log in with your LinkedIn account",
          "Authorize the application",
          "You'll be redirected back automatically",
        ],
      },
    ],
  },
  tiktok: {
    type: "tiktok",
    name: "TikTok",
    icon: Video,
    color: "text-pink-500",
    description: "Connect TikTok to manage videos, comments, and analytics.",
    setupUrl: "https://developers.tiktok.com/",
    steps: [
      {
        id: "welcome",
        title: "Connect TikTok",
        description: "Authorize access to your TikTok account",
        fields: [],
        instructions: [
          "Click 'Next' to be redirected to TikTok",
          "Log in with your TikTok account",
          "Authorize the application",
          "You'll be redirected back automatically",
        ],
      },
    ],
  },
  discord: {
    type: "discord",
    name: "Discord",
    icon: Gamepad2,
    color: "text-indigo-500",
    description: "Connect Discord to manage channels, messages, and server activity.",
    setupUrl: "https://discord.com/developers/applications",
    steps: [
      {
        id: "bot_token",
        title: "Discord Bot Token",
        description: "Create a bot and enter its token",
        fields: [
          { key: "bot_token", label: "Bot Token", type: "password", placeholder: "MTIx...", help: "Create a bot in Discord Developer Portal" },
        ],
        instructions: [
          "Go to discord.com/developers/applications",
          "Create a new application",
          "Go to Bot > Add Bot",
          "Copy the bot token",
          "Enable Message Content Intent under Privileged Gateway Intents",
        ],
      },
    ],
  },
  slack: {
    type: "slack",
    name: "Slack",
    icon: Slack,
    color: "text-green-500",
    description: "Connect Slack to manage channels, messages, and workspace activity.",
    setupUrl: "https://api.slack.com/apps",
    steps: [
      {
        id: "bot_token",
        title: "Slack Bot Token",
        description: "Create a bot app and enter its token",
        fields: [
          { key: "bot_token", label: "Bot Token", type: "password", placeholder: "xoxb-...", help: "Create a bot in Slack API" },
        ],
        instructions: [
          "Go to api.slack.com/apps",
          "Create a new app",
          "Go to OAuth & Permissions",
          "Add scopes: channels:history, channels:read, chat:write",
          "Install to workspace",
          "Copy the Bot User OAuth Token",
        ],
      },
    ],
  },
  mastodon: {
    type: "mastodon",
    name: "Mastodon",
    icon: Globe,
    color: "text-purple-500",
    description: "Connect Mastodon to manage posts, notifications, and fediverse activity.",
    setupUrl: "https://mastodon.social/settings/applications",
    steps: [
      {
        id: "instance",
        title: "Mastodon Instance",
        description: "Enter your Mastodon instance URL",
        fields: [
          { key: "instance_url", label: "Instance URL", placeholder: "https://mastodon.social", help: "Your Mastodon instance URL" },
        ],
      },
      {
        id: "credentials",
        title: "Application Credentials",
        description: "Create an application and enter credentials",
        fields: [
          { key: "client_id", label: "Client ID", placeholder: "...", help: "From Settings > Development > Applications" },
          { key: "client_secret", label: "Client Secret", type: "password", placeholder: "...", help: "From Settings > Development > Applications" },
        ],
        instructions: [
          "Go to your instance Settings > Development > Applications",
          "Create a new application",
          "Set scopes: read, write, follow",
          "Copy Client ID and Client Secret",
        ],
      },
    ],
  },
};

export function getConnectorConfig(type: string): ConnectorConfig | undefined {
  return CONNECTOR_CONFIGS[type];
}

export function getAllConnectors(): ConnectorConfig[] {
  return Object.values(CONNECTOR_CONFIGS);
}
