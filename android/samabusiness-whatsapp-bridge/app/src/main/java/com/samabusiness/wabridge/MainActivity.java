package com.samabusiness.wabridge;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.text.DateFormat;
import java.util.Date;

public final class MainActivity extends Activity {
    private static final String WHATSAPP_BUSINESS_PACKAGE = "com.whatsapp.w4b";
    private static final String BUSINESS_PHONE = "+221 77 337 47 62";
    private static final String BRIDGE_VERSION = "3.0.0";
    private static final String PREFS = "samabusiness_wabiz_bridge";
    private static final String PREF_LAST_RESULT = "last_result";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent incoming) {
        Uri data = incoming == null ? null : incoming.getData();
        if (data != null && "samabusiness-wabiz".equalsIgnoreCase(data.getScheme())) {
            forward(data);
        } else {
            showDiagnostic();
        }
    }

    private void showDiagnostic() {
        final PackageManager pm = getPackageManager();
        final boolean installed = isBusinessInstalled(pm);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(246, 248, 247));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(28), dp(22), dp(28));
        scroll.addView(root, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT,
                ScrollView.LayoutParams.WRAP_CONTENT));

        TextView eyebrow = text("SAMA BUSINESS", 12, Color.rgb(18, 92, 73), Typeface.BOLD);
        root.addView(eyebrow);

        TextView title = text("WhatsApp Business\nDiagnostic", 30, Color.rgb(22, 35, 31), Typeface.BOLD);
        LinearLayout.LayoutParams titleParams = wrap();
        titleParams.topMargin = dp(8);
        root.addView(title, titleParams);

        TextView subtitle = text(
                "Ce module vérifie le bon WhatsApp et force Sama Business à cibler WhatsApp Business.",
                15,
                Color.rgb(84, 98, 93),
                Typeface.NORMAL);
        LinearLayout.LayoutParams subtitleParams = wrap();
        subtitleParams.topMargin = dp(10);
        root.addView(subtitle, subtitleParams);

        LinearLayout statusCard = card();
        LinearLayout.LayoutParams cardParams = matchWrap();
        cardParams.topMargin = dp(22);
        root.addView(statusCard, cardParams);

        TextView status = text(
                installed ? "✓ WhatsApp Business détecté" : "✕ WhatsApp Business non détecté",
                18,
                installed ? Color.rgb(15, 111, 79) : Color.rgb(176, 56, 48),
                Typeface.BOLD);
        statusCard.addView(status);

        TextView packageLine = text(
                installed ? businessPackageDescription(pm) : "Package recherché : " + WHATSAPP_BUSINESS_PACKAGE,
                14,
                Color.rgb(71, 86, 81),
                Typeface.NORMAL);
        LinearLayout.LayoutParams lineParams = wrap();
        lineParams.topMargin = dp(10);
        statusCard.addView(packageLine, lineParams);

        TextView phone = text("Numéro Business configuré : " + BUSINESS_PHONE, 15,
                Color.rgb(31, 48, 42), Typeface.BOLD);
        LinearLayout.LayoutParams phoneParams = wrap();
        phoneParams.topMargin = dp(14);
        statusCard.addView(phone, phoneParams);

        TextView privacy = text(
                "Android peut vérifier l'application WhatsApp Business installée, mais WhatsApp ne permet pas à ce module de lire le numéro connecté. Le numéro ci-dessus est celui configuré dans Sama Business.",
                12,
                Color.rgb(99, 111, 107),
                Typeface.NORMAL);
        LinearLayout.LayoutParams privacyParams = wrap();
        privacyParams.topMargin = dp(8);
        statusCard.addView(privacy, privacyParams);

        String last = getSharedPreferences(PREFS, MODE_PRIVATE)
                .getString(PREF_LAST_RESULT, "Aucun test de routage enregistré pour le moment.");
        TextView lastResult = text(last, 13, Color.rgb(67, 79, 75), Typeface.NORMAL);
        lastResult.setBackground(rounded(Color.rgb(236, 241, 239), 14));
        lastResult.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams lastParams = matchWrap();
        lastParams.topMargin = dp(16);
        statusCard.addView(lastResult, lastParams);

        Button test = primaryButton(installed ? "Tester l'ouverture WhatsApp Business" : "Installer WhatsApp Business");
        LinearLayout.LayoutParams testParams = matchWrap();
        testParams.topMargin = dp(22);
        root.addView(test, testParams);
        test.setOnClickListener(v -> {
            if (!isBusinessInstalled(pm)) {
                rememberResult("WhatsApp Business non détecté — ouverture de la fiche d'installation.");
                openBusinessStore();
                return;
            }
            boolean ok = openBusinessHome(pm);
            rememberResult(ok
                    ? "Test manuel OK — WhatsApp Business a été ciblé directement."
                    : "Échec du test manuel — activité de lancement WhatsApp Business introuvable.");
            if (!ok) {
                Toast.makeText(this, "WhatsApp Business est détecté mais ne peut pas être ouvert", Toast.LENGTH_LONG).show();
            }
        });

        Button refresh = secondaryButton("Actualiser le diagnostic");
        LinearLayout.LayoutParams refreshParams = matchWrap();
        refreshParams.topMargin = dp(12);
        root.addView(refresh, refreshParams);
        refresh.setOnClickListener(v -> showDiagnostic());

        Button sama = secondaryButton("Ouvrir Sama Business");
        LinearLayout.LayoutParams samaParams = matchWrap();
        samaParams.topMargin = dp(12);
        root.addView(sama, samaParams);
        sama.setOnClickListener(v -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://samabusiness.dakarstyle.com")));
            } catch (ActivityNotFoundException ignored) {
                Toast.makeText(this, "Impossible d'ouvrir Sama Business", Toast.LENGTH_SHORT).show();
            }
        });

        TextView footer = text(
                "Bridge Android v" + BRIDGE_VERSION + "  •  cible exclusive : " + WHATSAPP_BUSINESS_PACKAGE,
                12,
                Color.rgb(110, 122, 118),
                Typeface.NORMAL);
        footer.setGravity(Gravity.CENTER_HORIZONTAL);
        LinearLayout.LayoutParams footerParams = matchWrap();
        footerParams.topMargin = dp(24);
        root.addView(footer, footerParams);

        setContentView(scroll);
    }

    private void forward(Uri data) {
        String phone = normalizePhone(data.getQueryParameter("phone"));
        String text = safeText(data.getQueryParameter("text"));
        if (phone.isEmpty()) {
            rememberResult("Routage refusé — numéro client invalide.");
            Toast.makeText(this, "Numéro client invalide", Toast.LENGTH_SHORT).show();
            showDiagnostic();
            return;
        }

        PackageManager pm = getPackageManager();
        if (!isBusinessInstalled(pm)) {
            rememberResult("Routage impossible — WhatsApp Business non détecté dans ce profil Android.");
            Toast.makeText(this, "WhatsApp Business non détecté dans ce profil Android", Toast.LENGTH_LONG).show();
            showDiagnostic();
            return;
        }

        if (openDirectBusinessChat(pm, phone, text)) {
            rememberResult("Routage client OK — conversation envoyée vers WhatsApp Business.");
            finish();
            return;
        }

        if (openBusinessShare(pm, phone, text)) {
            rememberResult("Routage client OK — partage envoyé vers WhatsApp Business.");
            finish();
            return;
        }

        rememberResult("Routage partiel — WhatsApp Business détecté mais aucune activité de conversation compatible.");
        Toast.makeText(this,
                "WhatsApp Business est installé mais aucune activité compatible n'a été trouvée",
                Toast.LENGTH_LONG).show();
        showDiagnostic();
    }

    private boolean isBusinessInstalled(PackageManager pm) {
        try {
            ApplicationInfo info = pm.getApplicationInfo(WHATSAPP_BUSINESS_PACKAGE, 0);
            return info.enabled;
        } catch (PackageManager.NameNotFoundException notFound) {
            return false;
        }
    }

    private String businessPackageDescription(PackageManager pm) {
        try {
            PackageInfo info = pm.getPackageInfo(WHATSAPP_BUSINESS_PACKAGE, 0);
            String version = info.versionName == null ? "version inconnue" : "v" + info.versionName;
            return "Application : " + WHATSAPP_BUSINESS_PACKAGE + "  •  " + version;
        } catch (PackageManager.NameNotFoundException ignored) {
            return "Package recherché : " + WHATSAPP_BUSINESS_PACKAGE;
        }
    }

    private boolean openDirectBusinessChat(PackageManager pm, String phone, String text) {
        Uri.Builder target = new Uri.Builder()
                .scheme("https")
                .authority("wa.me")
                .appendPath(phone);
        if (!text.isEmpty()) target.appendQueryParameter("text", text);

        Intent business = new Intent(Intent.ACTION_VIEW, target.build());
        business.setPackage(WHATSAPP_BUSINESS_PACKAGE);
        business.addCategory(Intent.CATEGORY_BROWSABLE);
        business.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        ComponentName resolved = business.resolveActivity(pm);
        if (resolved == null || !WHATSAPP_BUSINESS_PACKAGE.equals(resolved.getPackageName())) {
            return false;
        }

        business.setComponent(resolved);
        try {
            Toast.makeText(this, "Ouverture WhatsApp Business", Toast.LENGTH_SHORT).show();
            startActivity(business);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        }
    }

    private boolean openBusinessShare(PackageManager pm, String phone, String text) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.setPackage(WHATSAPP_BUSINESS_PACKAGE);
        send.putExtra(Intent.EXTRA_TEXT, TextUtils.isEmpty(text) ? "Bonjour" : text);
        send.putExtra("jid", phone + "@s.whatsapp.net");
        send.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        ComponentName resolved = send.resolveActivity(pm);
        if (resolved == null || !WHATSAPP_BUSINESS_PACKAGE.equals(resolved.getPackageName())) {
            return false;
        }

        send.setComponent(resolved);
        try {
            Toast.makeText(this, "Ouverture WhatsApp Business", Toast.LENGTH_SHORT).show();
            startActivity(send);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        }
    }

    private boolean openBusinessHome(PackageManager pm) {
        Intent launch = pm.getLaunchIntentForPackage(WHATSAPP_BUSINESS_PACKAGE);
        if (launch == null) return false;
        launch.setPackage(WHATSAPP_BUSINESS_PACKAGE);
        launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try {
            startActivity(launch);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        }
    }

    private void openBusinessStore() {
        try {
            Intent market = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + WHATSAPP_BUSINESS_PACKAGE));
            startActivity(market);
        } catch (ActivityNotFoundException noStore) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=" + WHATSAPP_BUSINESS_PACKAGE)));
            } catch (ActivityNotFoundException ignored) {
                Toast.makeText(this, "Aucun magasin d'applications disponible", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void rememberResult(String message) {
        String stamp = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(new Date());
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        prefs.edit().putString(PREF_LAST_RESULT, stamp + " — " + message).apply();
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(18), dp(18), dp(18));
        card.setBackground(rounded(Color.WHITE, 22));
        card.setElevation(dp(2));
        return card;
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(15);
        button.setAllCaps(false);
        button.setTextColor(Color.WHITE);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(16), dp(14), dp(16), dp(14));
        button.setBackground(rounded(Color.rgb(15, 104, 79), 16));
        return button;
    }

    private Button secondaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(15);
        button.setAllCaps(false);
        button.setTextColor(Color.rgb(28, 70, 58));
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(16), dp(13), dp(16), dp(13));
        button.setBackground(rounded(Color.rgb(229, 238, 234), 16));
        return button;
    }

    private TextView text(String value, int sp, int color, int style) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setTypeface(Typeface.DEFAULT, style);
        view.setLineSpacing(0, 1.12f);
        return view;
    }

    private GradientDrawable rounded(int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static String normalizePhone(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("\\D", "");
        if (digits.startsWith("00")) digits = digits.substring(2);
        if (digits.length() == 9 && (digits.startsWith("7") || digits.startsWith("3"))) {
            digits = "221" + digits;
        }
        if (digits.length() < 8 || digits.length() > 15) return "";
        return digits;
    }

    private static String safeText(String raw) {
        if (raw == null) return "";
        String value = raw.trim();
        if (value.length() > 4000) value = value.substring(0, 4000);
        return value;
    }
}
