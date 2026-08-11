package com.samabusiness.wabridge;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String WHATSAPP_BUSINESS_PACKAGE = "com.whatsapp.w4b";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        forward(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        forward(intent);
    }

    private void forward(Intent incoming) {
        Uri data = incoming == null ? null : incoming.getData();
        if (data == null || !"samabusiness-wabiz".equalsIgnoreCase(data.getScheme())) {
            finish();
            return;
        }

        String phone = normalizePhone(data.getQueryParameter("phone"));
        String text = safeText(data.getQueryParameter("text"));
        if (phone.isEmpty()) {
            Toast.makeText(this, "Numéro client invalide", Toast.LENGTH_SHORT).show();
            finishAndRemoveTask();
            return;
        }

        PackageManager pm = getPackageManager();
        if (!isBusinessInstalled(pm)) {
            Toast.makeText(this, "WhatsApp Business non détecté dans ce profil Android", Toast.LENGTH_LONG).show();
            openBusinessStore();
            finishAndRemoveTask();
            return;
        }

        if (openDirectBusinessChat(pm, phone, text)) {
            finishAndRemoveTask();
            return;
        }

        if (openBusinessShare(pm, phone, text)) {
            finishAndRemoveTask();
            return;
        }

        Toast.makeText(this, "WhatsApp Business est installé mais aucune activité compatible n’a été trouvée", Toast.LENGTH_LONG).show();
        openBusinessHome(pm);
        finishAndRemoveTask();
    }

    private boolean isBusinessInstalled(PackageManager pm) {
        try {
            ApplicationInfo info = pm.getApplicationInfo(WHATSAPP_BUSINESS_PACKAGE, 0);
            return info.enabled;
        } catch (PackageManager.NameNotFoundException notFound) {
            return false;
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
        business.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

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
        send.putExtra(Intent.EXTRA_TEXT, text.isEmpty() ? "Bonjour" : text);
        send.putExtra("jid", phone + "@s.whatsapp.net");
        send.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

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

    private void openBusinessHome(PackageManager pm) {
        Intent launch = pm.getLaunchIntentForPackage(WHATSAPP_BUSINESS_PACKAGE);
        if (launch == null) return;
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try {
            startActivity(launch);
        } catch (ActivityNotFoundException ignored) {
            // Package was visible but launcher activity is unavailable.
        }
    }

    private void openBusinessStore() {
        try {
            Intent market = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + WHATSAPP_BUSINESS_PACKAGE));
            market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(market);
        } catch (ActivityNotFoundException noStore) {
            Intent browser = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=" + WHATSAPP_BUSINESS_PACKAGE));
            browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(browser);
        }
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
