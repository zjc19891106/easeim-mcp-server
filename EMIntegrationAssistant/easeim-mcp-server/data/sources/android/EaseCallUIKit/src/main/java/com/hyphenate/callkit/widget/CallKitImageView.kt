package com.hyphenate.callkit.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.drawable.Drawable
import android.util.AttributeSet
import android.view.MotionEvent
import androidx.appcompat.widget.AppCompatImageView
import com.hyphenate.callkit.R

/**
 * \~chinese
 * callkit 自定义ImageView，实现圆角矩形和边框，并当用户点击时改变颜色
 *
 * \~english
 * Customized ImageView, implemented rounded rectangle and border, and change color when user press
 */
class CallKitImageView : AppCompatImageView {
    // paint when user press
    private var pressPaint: Paint? = null
    private var width = 0
    private var height = 0

    // border color
    private var borderColor = 0

    // width of border
    private var borderWidth = 0

    // alpha when pressed
    private var pressAlpha = 0

    // color when pressed
    private var pressColor = 0

    // radius
    private var radius = 0

    // rectangle or round, 1 is circle, 2 is rectangle
    private var shapeType = 0
    
    // Add a new paint for drawing border
    private val borderPaint = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.STROKE
    }
    
    // Add a rounded rectangle path for clipping
    private val roundRectPath = Path()
    private val roundRectRectF = RectF()
    
    // Flag to track if GIF is being displayed
    private var isDisplayingGif = false

    constructor(context: Context) : super(context) {
        init(context, null)
    }

    constructor(context: Context, attrs: AttributeSet?) : super(context, attrs) {
        init(context, attrs)
    }

    constructor(context: Context, attrs: AttributeSet?, defStyleAttr: Int) : super(
        context,
        attrs,
        defStyleAttr
    ) {
        init(context, attrs)
    }

    private fun init(context: Context, attrs: AttributeSet?) {
        //init the value
        borderWidth = 0
        borderColor = -0x22000001
        pressAlpha = 0x42
        pressColor = 0x42000000
        radius = 16
        shapeType = 0

        // get attribute of CallKitImageView
        if (attrs != null) {
            val array = context.obtainStyledAttributes(attrs, R.styleable.CallKitImageView)
            borderColor = array.getColor(R.styleable.CallKitImageView_ease_border_color, borderColor)
            borderWidth = array.getDimensionPixelOffset(
                R.styleable.CallKitImageView_ease_border_width,
                borderWidth
            )
            pressAlpha = array.getInteger(R.styleable.CallKitImageView_ease_press_alpha, pressAlpha)
            pressColor = array.getColor(R.styleable.CallKitImageView_ease_press_color, pressColor)
            radius = array.getDimensionPixelOffset(R.styleable.CallKitImageView_ease_radius, radius)
            shapeType = array.getInteger(R.styleable.CallKitImageView_shape_type, shapeType)
            array.recycle()
        }

        // Store the original background before we modify it
        val originalBackground = background
        
        // If we have a custom shape, store the background for custom drawing
        if (shapeType != 0 && originalBackground != null) {
            customBackground = originalBackground
            super.setBackground(null)
        }

        // set paint when pressed
        pressPaint = Paint()
        pressPaint!!.isAntiAlias = true
        pressPaint!!.style = Paint.Style.FILL
        pressPaint!!.color = pressColor
        pressPaint!!.alpha = 0
        pressPaint!!.flags = Paint.ANTI_ALIAS_FLAG
        
        // Configure border paint
        borderPaint.color = borderColor
        borderPaint.strokeWidth = borderWidth.toFloat()
        
        // We need hardware acceleration for better GIF rendering
        setLayerType(LAYER_TYPE_HARDWARE, null)
    }
    
    // Override setImageDrawable to detect GIFs
    override fun setImageDrawable(drawable: Drawable?) {
        isDisplayingGif = drawable != null && 
                drawable.javaClass.name.contains("Gif", ignoreCase = true)
        super.setImageDrawable(drawable)
    }

    // Override setBackground to handle custom shape drawing
    override fun setBackground(background: Drawable?) {
        if (shapeType != 0) {
            // Store the background for custom drawing instead of setting it directly
            customBackground = background
            // Don't call super.setBackground() to prevent default background drawing
            invalidate()
        } else {
            super.setBackground(background)
        }
    }
    
    // Also override setBackgroundResource to ensure it works with our custom logic
    override fun setBackgroundResource(resId: Int) {
        if (shapeType != 0) {
            // Convert resource to drawable and store it for custom drawing
            customBackground = if (resId != 0) {
                context.getDrawable(resId)
            } else {
                null
            }
            invalidate()
        } else {
            super.setBackgroundResource(resId)
        }
    }
    
    // Override setBackgroundColor for completeness
    override fun setBackgroundColor(color: Int) {
        if (shapeType != 0) {
            // Create a ColorDrawable for custom drawing
            customBackground = android.graphics.drawable.ColorDrawable(color)
            invalidate()
        } else {
            super.setBackgroundColor(color)
        }
    }
    
    // Store the original background for custom drawing
    private var customBackground: Drawable? = null
    
    /**
     * Set background that will be drawn with custom shape
     */
    fun setCustomBackground(background: Drawable?) {
        customBackground = background
        invalidate()
    }
    
    override fun onDraw(canvas: Canvas) {
        if (shapeType == 0 || drawable == null) {
            super.onDraw(canvas)
            return
        }
        
        // Draw background shape first
        drawBackgroundShape(canvas)
        
        // Save the canvas state
        canvas.save()
        
        // Apply the shape mask
        applyShapeMask(canvas)
        
        // Draw the image content
        super.onDraw(canvas)
        
        // Restore to draw border and press effects outside the clipping
        canvas.restore()
        
        if (isClickable) {
            drawPress(canvas)
        }
        
        drawBorder(canvas)
    }
    
    /**
     * Draw background shape before drawing the image
     */
    private fun drawBackgroundShape(canvas: Canvas) {
        val bgDrawable = customBackground
        if (bgDrawable != null) {
            // For shape drawing, we need to extract the color and draw it ourselves
            // instead of letting the drawable draw itself (which would be rectangular)
            
            val color = extractColorFromDrawable(bgDrawable)
            
            if (color != android.graphics.Color.TRANSPARENT) {
                val bgPaint = Paint().apply {
                    isAntiAlias = true
                    style = Paint.Style.FILL
                    this.color = color
                }
                
                when (shapeType) {
                    1 -> {
                        // Draw circular background
                        val centerX = width / 2f
                        val centerY = height / 2f
                        val radius = Math.min(width, height) / 2f - borderWidth / 2f
                        canvas.drawCircle(centerX, centerY, radius, bgPaint)
                    }
                    2 -> {
                        // Draw rounded rectangle background
                        val rectF = RectF(
                            borderWidth / 2f,
                            borderWidth / 2f,
                            width - borderWidth / 2f,
                            height - borderWidth / 2f
                        )
                        canvas.drawRoundRect(rectF, radius.toFloat(), radius.toFloat(), bgPaint)
                    }
                }
            }
        }
    }
    
    /**
     * Extract color from various types of drawables
     */
    private fun extractColorFromDrawable(drawable: Drawable): Int {
        return when (drawable) {
            is android.graphics.drawable.ColorDrawable -> drawable.color
            else -> {
                // For other drawable types, try to draw them to a bitmap and get the average color
                // This is a more robust approach for color resources
                try {
                    // Create a small bitmap to sample the drawable color
                    val bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    drawable.setBounds(0, 0, 1, 1)
                    drawable.draw(canvas)
                    val color = bitmap.getPixel(0, 0)
                    bitmap.recycle()
                    color
                } catch (e: Exception) {
                    android.graphics.Color.TRANSPARENT
                }
            }
        }
    }
    
    /**
     * Apply the shape mask to the canvas based on shapeType
     */
    private fun applyShapeMask(canvas: Canvas) {
        if (shapeType == 1) {
            // Circle shape
            val centerX = width / 2f
            val centerY = height / 2f
            val radius = Math.min(width, height) / 2f - borderWidth / 2f
            
            // Create a circular clip path
            val path = Path()
            path.addCircle(centerX, centerY, radius, Path.Direction.CW)
            canvas.clipPath(path)
        } else if (shapeType == 2) {
            // Rounded rectangle
            roundRectRectF.set(
                borderWidth / 2f,
                borderWidth / 2f,
                width - borderWidth / 2f,
                height - borderWidth / 2f
            )
            
            // Create a rounded rectangle clip path
            roundRectPath.reset()
            roundRectPath.addRoundRect(
                roundRectRectF,
                radius.toFloat(),
                radius.toFloat(),
                Path.Direction.CW
            )
            canvas.clipPath(roundRectPath)
        }
    }

    /**
     * draw the effect when pressed
     */
    private fun drawPress(canvas: Canvas) {
        pressPaint?.let { paint ->
            if (shapeType == 1) {
                canvas.drawCircle(
                    width / 2f,
                    height / 2f,
                    Math.min(width, height) / 2f - borderWidth / 2f,
                    paint
                )
            } else if (shapeType == 2) {
                val rectF = RectF(
                    borderWidth / 2f,
                    borderWidth / 2f,
                    width - borderWidth / 2f,
                    height - borderWidth / 2f
                )
                canvas.drawRoundRect(rectF, radius.toFloat(), radius.toFloat(), paint)
            }
        }
    }

    /**
     * draw customized border
     */
    private fun drawBorder(canvas: Canvas) {
        if (borderWidth > 0) {
            borderPaint.color = borderColor
            
            if (shapeType == 1) {
                // Circle border
                val centerX = width / 2f
                val centerY = height / 2f
                val radius = Math.min(width, height) / 2f - borderWidth / 2f
                canvas.drawCircle(centerX, centerY, radius, borderPaint)
            } else if (shapeType == 2) {
                // Rounded rectangle border
                val rectF = RectF(
                    borderWidth / 2f,
                    borderWidth / 2f,
                    width - borderWidth / 2f,
                    height - borderWidth / 2f
                )
                canvas.drawRoundRect(rectF, radius.toFloat(), radius.toFloat(), borderPaint)
            }
        }
    }

    /**
     * monitor the size change
     *
     * @param w
     * @param h
     * @param oldw
     * @param oldh
     */
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        width = w
        height = h
    }

    /**
     * monitor if touched
     *
     * @param event
     * @return
     */
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                pressPaint!!.alpha = pressAlpha
                invalidate()
            }

            MotionEvent.ACTION_UP -> {
                pressPaint!!.alpha = 0
                invalidate()
            }

            MotionEvent.ACTION_MOVE -> {}
            else -> {
                pressPaint!!.alpha = 0
                invalidate()
            }
        }
        return super.onTouchEvent(event)
    }

    /**
     * set border color
     */
    fun setBorderColor(borderColor: Int) {
        this.borderColor = borderColor
        invalidate()
    }

    /**
     * set border width
     */
    fun setBorderWidth(borderWidth: Int) {
        this.borderWidth = borderWidth
        invalidate()
    }

    /**
     * set alpha when pressed
     *
     * @param pressAlpha
     */
    fun setPressAlpha(pressAlpha: Int) {
        this.pressAlpha = pressAlpha
    }

    /**
     * set color when pressed
     *
     * @param pressColor
     */
    fun setPressColor(pressColor: Int) {
        this.pressColor = pressColor
    }

    /**
     * set radius
     *
     * @param radius
     */
    fun setRadius(radius: Int) {
        this.radius = radius
        invalidate()
    }

    /**
     * set shape,1 is circle, 2 is rectangle
     *
     * @param shapeType
     */
    fun setShapeType(shapeType: Int) {
        val oldShapeType = this.shapeType
        this.shapeType = shapeType
        
        // Handle background changes when shape type changes
        if (oldShapeType == 0 && shapeType != 0) {
            // Moving from no shape to custom shape
            val currentBackground = background
            if (currentBackground != null) {
                customBackground = currentBackground
                // Clear the system background to prevent interference
                super.setBackground(null)
            }
        } else if (oldShapeType != 0 && shapeType == 0) {
            // Moving from custom shape to no shape
            if (customBackground != null) {
                super.setBackground(customBackground)
                customBackground = null
            }
        }
        
        invalidate()
    }

    /**
     * set shape type
     * @param shapeType
     */
    fun setShapeType(shapeType: ShapeType?) {
        if (shapeType == null) {
            return
        }
        setShapeType(shapeType.ordinal)
    }

    /**
     * 图片形状
     */
    enum class ShapeType {
        NONE, ROUND, RECTANGLE
    }

    companion object {
        // default bitmap config
        private val BITMAP_CONFIG = Bitmap.Config.ARGB_8888
        private const val COLORDRAWABLE_DIMENSION = 1
    }
}