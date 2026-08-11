package com.samabusiness.wabridge;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import java.util.Locale;

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
            finish();
            return;
        }

        Uri.Builder target = new Uri.Builder()
                .scheme("https")
                .authority("api.whatsapp.com")
                .path("send")
                .appendQueryParameter("phone", phone);
        if (!text.isEmpty()) target.appendQueryParameter("text", text);

        Intent business = new Intent(Intent.ACTION_VIEW, target.build());
        business.setPackage(WHATSAPP_BUSINESS_PACKAGE);
        business.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        try {
            startActivity(business);
        } catch (ActivityNotFoundException notInstalled) {
            openBusinessStore();
        } finally {
            finishAndRemoveTask();
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
