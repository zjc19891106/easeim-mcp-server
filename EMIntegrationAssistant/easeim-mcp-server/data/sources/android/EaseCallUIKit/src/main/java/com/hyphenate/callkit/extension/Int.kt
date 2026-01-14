package com.hyphenate.callkit.extension

import android.content.Context
import android.util.TypedValue

/**
 * \~chinese
 * 将dp转换为px
 *
 * \~english
 * Convert dp to px
 */
fun Int.dpToPx(context: Context) = TypedValue.applyDimension(
    TypedValue.COMPLEX_UNIT_DIP,
    this.toFloat(),
    context.resources.displayMetrics
).toInt()
