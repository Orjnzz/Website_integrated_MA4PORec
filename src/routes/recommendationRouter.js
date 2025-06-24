const express = require('express');
const router = express.Router();
const db = require('../config/db/connect');
const { generateText } = require('ai');
const { openai } = require('@ai-sdk/openai');
const dotenv = require('dotenv').config();
const util = require('util');
const queryAsync = util.promisify(db.query).bind(db);

console.log('===== RECOMMENDATION ROUTER INITIALIZED =====');
console.log('OpenAI API Key configured:', process.env.OPENAI_API_KEY ? 'YES' : 'NO');

// Hàm để lấy thêm sản phẩm phổ biến nếu không đủ 20 items
async function fetchAdditionalProducts(existingProductIds, limit) {
    console.log(`[fetchAdditionalProducts] Fetching ${limit} additional products`);
    console.log(`[fetchAdditionalProducts] Excluding ${existingProductIds.length} existing products`);
    
    try {
        // Tạo danh sách product_variant_id đã có để loại trừ
        const excludeIds = existingProductIds.map(product => product.product_variant_id);
        const placeholders = excludeIds.length > 0 ? excludeIds.map(() => '?').join(',') : '0';
        
        // Query lấy thêm sản phẩm dựa trên lượt xem cao
        const query = `
            SELECT 
                pv.product_variant_id,
                p.product_name,
                p.product_description,
                pv.product_variant_name,
                pv.product_variant_price,
                c.category_name,
                c.category_id,
                vp.product_view_count as view_count,
                NULL as latest_view_date
            FROM view_products_resume vp
            JOIN product_variants pv ON vp.product_variant_id = pv.product_variant_id
            JOIN products p ON pv.product_id = p.product_id
            JOIN categories c ON p.category_id = c.category_id
            WHERE vp.product_variant_id NOT IN (${placeholders})
            ORDER BY vp.product_view_count DESC
            LIMIT ${limit}
        `;
        
        console.log(`[fetchAdditionalProducts] Executing query with ${excludeIds.length} excluded IDs`);
        const additionalProducts = await queryAsync(query, excludeIds);
        console.log(`[fetchAdditionalProducts] Found ${additionalProducts.length} additional products`);
        
        return additionalProducts;
    } catch (error) {
        console.error('[fetchAdditionalProducts] Error:', error);
        return [];
    }
}

// Route cho API recommendation
router.get('/recommend', async (req, res) => {
    console.log('===== RECOMMENDATION API CALLED =====');
    console.log('Request URL:', req.originalUrl);
    console.log('User authenticated:', req.session?.user_id ? 'YES' : 'NO');
    
    try {
        const REQUIRED_PRODUCTS = 40; // Số lượng sản phẩm cần có để gửi cho GPT
        const customer_id = req.session?.user_id || null;
        let query;
        let queryParams = [];

        console.log(`[recommend] User ID: ${customer_id || 'Anonymous'}`);
        
        // Nếu user đã đăng nhập, lấy sản phẩm của user đó dựa trên ngày xem mới nhất
        if (customer_id) {
            console.log('[recommend] Getting products by user history from the most recent view date');
            
            // Trước tiên, tìm ngày xem mới nhất của người dùng này
            const getLatestDateQuery = `
                SELECT MAX(view_date) as latest_date
                FROM product_views
                WHERE customer_id = ?
            `;
            
            try {
                const latestDateResult = await queryAsync(getLatestDateQuery, [customer_id]);
                const latestDate = latestDateResult[0]?.latest_date;
                
                if (!latestDate) {
                    console.log('[recommend] No view history found for user');
                    // Nếu không có lịch sử xem, sẽ chuyển sang lấy sản phẩm phổ biến sau
                    query = null;
                } else {
                    console.log(`[recommend] Latest view date for user: ${latestDate}`);
                    
                    // Lấy sản phẩm chỉ từ ngày xem mới nhất
                    query = `
                        SELECT 
                            pv.product_variant_id,
                            p.product_name,
                            p.product_description,
                            pv.product_variant_name,
                            pv.product_variant_price,
                            c.category_name,
                            c.category_id,
                            view.view_date as latest_view_date,
                            COUNT(view.view_id) as view_count
                        FROM product_views view
                        JOIN product_variants pv ON view.product_variant_id = pv.product_variant_id
                        JOIN products p ON pv.product_id = p.product_id
                        JOIN categories c ON p.category_id = c.category_id
                        WHERE view.customer_id = ? 
                        AND DATE(view.view_date) = DATE(?)
                        GROUP BY pv.product_variant_id, c.category_id
                        ORDER BY view_count DESC
                        LIMIT ${REQUIRED_PRODUCTS}
                    `;
                    queryParams = [customer_id, latestDate];
                }
            } catch (dateErr) {
                console.error('[recommend] Error getting latest view date:', dateErr);
                // Nếu có lỗi khi lấy ngày, cũng sẽ chuyển sang lấy sản phẩm phổ biến
                query = null;
            }
        } else {
            // Với người dùng không đăng nhập, lấy sản phẩm chỉ từ ngày xem mới nhất trong hệ thống
            console.log('[recommend] Getting products viewed on the most recent date for anonymous user');
            
            try {
                // Tìm ngày xem mới nhất trong hệ thống
                const getLatestSystemDateQuery = `
                    SELECT MAX(view_date) as latest_date
                    FROM product_views
                `;
                
                const latestSystemDateResult = await queryAsync(getLatestSystemDateQuery);
                const latestSystemDate = latestSystemDateResult[0]?.latest_date;
                
                if (!latestSystemDate) {
                    console.log('[recommend] No view history found in the system');
                    // Nếu không có lịch sử xem nào, sẽ chuyển sang lấy sản phẩm phổ biến sau
                    query = null;
                } else {
                    console.log(`[recommend] Latest system view date: ${latestSystemDate}`);
                    
                    // Lấy sản phẩm chỉ từ ngày xem mới nhất trong hệ thống
                    query = `
                        SELECT 
                            pv.product_variant_id,
                            p.product_name,
                            p.product_description,
                            pv.product_variant_name,
                            pv.product_variant_price,
                            c.category_name,
                            c.category_id,
                            view.view_date as latest_view_date,
                            COUNT(view.view_id) as view_count
                        FROM product_views view
                        JOIN product_variants pv ON view.product_variant_id = pv.product_variant_id
                        JOIN products p ON pv.product_id = p.product_id
                        JOIN categories c ON p.category_id = c.category_id
                        WHERE DATE(view.view_date) = DATE(?)
                        GROUP BY pv.product_variant_id, c.category_id
                        ORDER BY view_count DESC
                        LIMIT ${REQUIRED_PRODUCTS}
                    `;
                    queryParams = [latestSystemDate];
                }
            } catch (sysDateErr) {
                console.error('[recommend] Error getting latest system view date:', sysDateErr);
                // Nếu có lỗi, chuyển sang lấy sản phẩm phổ biến
                query = null;
            }
        }

        console.log('[recommend] Executing main query');
        
        // Thực hiện truy vấn
        db.query(query, queryParams, async (err, results) => {
            if (err) {
                console.error('[recommend] Error querying products:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            console.log(`[recommend] Initial query returned ${results ? results.length : 0} products`);
            
            // Nếu không có kết quả, lấy sản phẩm từ view_products_resume
            if (!results || results.length === 0) {
                console.log('[recommend] No products found, using popular products instead');
                
                const popularProductsQuery = `
                    SELECT 
                        pv.product_variant_id,
                        p.product_name,
                        p.product_description,
                        pv.product_variant_name,
                        pv.product_variant_price,
                        c.category_name,
                        c.category_id,
                        vpr.product_view_count as view_count,
                        NULL as latest_view_date
                    FROM view_products_resume vpr
                    JOIN product_variants pv ON vpr.product_variant_id = pv.product_variant_id
                    JOIN products p ON pv.product_id = p.product_id
                    JOIN categories c ON p.category_id = c.category_id
                    ORDER BY vpr.product_view_count DESC
                    LIMIT ${REQUIRED_PRODUCTS}
                `;
                
                console.log('[recommend] Executing popular products query');
                
                db.query(popularProductsQuery, async (popularErr, popularResults) => {
                    if (popularErr || !popularResults || popularResults.length === 0) {
                        console.error('[recommend] Error querying popular products:', popularErr);
                        return res.status(200).json({ 
                            recommended_products: [],
                            message: 'No products found' 
                        });
                    }
                    
                    console.log(`[recommend] Found ${popularResults.length} popular products`);
                    
                    // Tiếp tục với sản phẩm phổ biến
                    processAndRecommendProducts(popularResults, res);
                });
                return;
            }
            
            // Nếu không đủ số lượng sản phẩm yêu cầu, lấy thêm sản phẩm phổ biến
            if (results.length < REQUIRED_PRODUCTS) {
                console.log(`[recommend] Not enough products from history (${results.length}/${REQUIRED_PRODUCTS}). Fetching additional products.`);
                const additionalProductsNeeded = REQUIRED_PRODUCTS - results.length;
                
                // Lấy thêm sản phẩm phổ biến (không trùng với các sản phẩm đã có)
                const additionalProducts = await fetchAdditionalProducts(results, additionalProductsNeeded);
                
                // Kết hợp danh sách
                results = [...results, ...additionalProducts];
                console.log(`[recommend] Combined ${results.length} products for recommendation.`);
            }

            // Xử lý và gửi recommendation 
            processAndRecommendProducts(results, res);
        });
    } catch (error) {
        console.error('[recommend] Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Hàm riêng để xử lý sản phẩm và gọi API OpenAI
async function processAndRecommendProducts(products, res) {
    console.log(`[processAndRecommendProducts] Processing ${products.length} products for recommendation`);
    
    try {
        // Phân tích các category_id đã xem gần đây nhất
        const recentlyViewedCategories = new Map();
        
        // Tạo map lưu trữ các sản phẩm theo category_id để dễ dàng xử lý sau này
        const productsByCategory = new Map();
        
        // Phân tích các sản phẩm để tìm danh mục được xem nhiều và gần đây nhất
        products.forEach(product => {
            // Xử lý category_id nếu có
            if (product.category_id) {
                // Tính điểm ưu tiên cho danh mục - kết hợp giữa thời gian xem gần đây và số lượt xem
                let categoryScore = product.view_count || 1; // Mặc định ít nhất là 1
                
                // Nếu có thông tin thời gian xem gần đây nhất, tăng điểm cho danh mục
                if (product.latest_view_date) {
                    // Chuyển đổi thành timestamp để dễ so sánh
                    const viewDate = new Date(product.latest_view_date).getTime();
                    const now = new Date().getTime();
                    const daysDiff = Math.floor((now - viewDate) / (1000 * 60 * 60 * 24));
                    
                    // Tăng điểm cho các danh mục được xem gần đây (trong vòng 3 ngày)
                    if (daysDiff <= 3) {
                        categoryScore += (3 - daysDiff) * 1000; // Càng gần đây, điểm càng cao
                    }
                }
                
                // Cập nhật điểm cho danh mục
                const currentScore = recentlyViewedCategories.get(product.category_id) || 0;
                recentlyViewedCategories.set(product.category_id, currentScore + categoryScore);
                
                // Thêm sản phẩm vào nhóm theo danh mục
                if (!productsByCategory.has(product.category_id)) {
                    productsByCategory.set(product.category_id, []);
                }
                productsByCategory.get(product.category_id).push(product);
            }
        });
        
        // Sắp xếp các danh mục theo điểm ưu tiên (từ cao đến thấp)
        const sortedCategories = [...recentlyViewedCategories.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0])
            .slice(0, 4); // Chỉ giữ lại 4 danh mục có điểm cao nhất
            
        console.log('[processAndRecommendProducts] Top 3 priority categories:', sortedCategories);
        
        // Tạo danh sách sản phẩm để gửi cho OpenAI, kèm theo thông tin về thời gian xem và danh mục
        const productList = products.map(product => {
            let viewDateInfo = '';
            if (product.latest_view_date) {
                viewDateInfo = `, Last viewed: ${product.latest_view_date}`;
            }
            
            return `${product.product_variant_id}: ${product.product_name} (${product.product_variant_name}): ${product.product_description?.substring(0, 100) || 'No description'}... Category: ${product.category_name} (ID: ${product.category_id})${viewDateInfo}, Price: ${product.product_variant_price}`;
        }).join('\n');

        console.log(`[processAndRecommendProducts] Created product list with ${products.length} items`);
        
        // Tạo thông tin về các danh mục ưu tiên để thêm vào prompt
        const categoryPriorityInfo = sortedCategories.length > 0 ? 
            `The user has shown the most interest in these categories (in order of priority): ${sortedCategories.join(', ')}. Prefer recommending products from these categories. And consider the most recent view time as a strong indicator of interest.` :
            'No specific category preference found. Recommend a diverse selection of products.'; 
            '';
        
        // Tạo prompt cho OpenAI với thông tin bổ sung về danh mục ưu tiên
        const prompt = `To provide tailored suggestions, follow these sequential subtasks based on the user's ongoing session activities:
1. Isolate pertinent item groupings from the user's current session activities, examining either single or multiple groupings. Ensure each grouping directly correlates with the user's session behavior.
2. Examine items within each grouping to infer the user's probable interaction intent for each.
3. Determine the intent that most accurately represents the user's current preferences from the inferred intents.
4. Reorder the candidate items based on their interaction likelihood, balancing item diversity across categories and genres. Prioritize items most relevant to the user's current session, while considering both view date and category similarity as strong interest indicators.

${categoryPriorityInfo}

Note: When reordering candidate items, prioritize items from the same categories as those the user has shown interest in recently, while also considering how recently the items were viewed. Products viewed more recently should generally be given higher priority.
Return 7 product_variant_ids in the order of most likely to least likely to be interacted with by the user.
Here are the products the user has viewed:
${productList}

Return only a JSON array of product_variant_ids in your recommended order. Format: ["id1", "id2", "id3", ...]`;

        console.log('[processAndRecommendProducts] Calling OpenAI API');
        console.log('[processAndRecommendProducts] Model: gpt-4o');
        
        try {
            // Gọi API OpenAI để lấy recommendation sử dụng generateText từ ai SDK
            const startTime = Date.now();
            
            const { text: content } = await generateText({
                model: openai('gpt-4o'),
                system: "You are a product recommendation assistant. Return only JSON format without any explanation.",
                prompt: prompt,
                temperature: 0.9,
                max_tokens: 500
            });
            
            const endTime = Date.now();
            
            console.log(`[processAndRecommendProducts] OpenAI API response received in ${endTime - startTime}ms`);
            console.log('[processAndRecommendProducts] Raw OpenAI response:', content);
            
            let recommendedIds;
            
            try {
                // Cố gắng parse JSON từ response
                recommendedIds = JSON.parse(content);
                console.log('[processAndRecommendProducts] Successfully parsed JSON response');
            } catch (jsonError) {
                // Nếu không phải JSON, thử extract array từ text
                console.error('[processAndRecommendProducts] Failed to parse JSON response:', jsonError);
                const match = content.match(/\[.*\]/s);
                if (match) {
                    try {
                        recommendedIds = JSON.parse(match[0]);
                        console.log('[processAndRecommendProducts] Extracted array from text response');
                    } catch (e) {
                        console.error('[processAndRecommendProducts] Failed to extract array from response:', e);
                        recommendedIds = products.map(p => p.product_variant_id.toString());
                        console.log('[processAndRecommendProducts] Using default product order');
                    }
                } else {
                    recommendedIds = products.map(p => p.product_variant_id.toString());
                    console.log('[processAndRecommendProducts] Using default product order (no array found)');
                }
            }

            console.log(`[processAndRecommendProducts] Recommended IDs: ${JSON.stringify(recommendedIds).substring(0, 100)}...`);
            
            // In tên của 7 sản phẩm đầu tiên được gợi ý
            const top7ProductNames = recommendedIds.slice(0, 7).map(id => {
                const product = products.find(p => p.product_variant_id.toString() === id.toString());
                return product ? `${id}: ${product.product_name} (${product.product_variant_name})` : id;
            });
            
            console.log('[processAndRecommendProducts] Top 7 recommended products:');
            top7ProductNames.forEach((name, index) => {
                console.log(`  ${index + 1}. ${name}`);
            });
            
            // Lấy thông tin chi tiết cho các sản phẩm được gợi ý
            if (Array.isArray(recommendedIds)) {
                const idPlaceholders = recommendedIds.map(() => '?').join(',');
                const detailQuery = `
                    SELECT 
                        pv.product_variant_id,
                        p.product_id,
                        p.product_name,
                        p.product_avt_img,
                        p.product_description,
                        pv.product_variant_name,
                        pv.product_variant_price,
                        COALESCE(vd.discount_amount, 0) as discount_amount,
                        c.category_id,
                        c.category_name
                    FROM product_variants pv
                    JOIN products p ON pv.product_id = p.product_id
                    JOIN categories c ON p.category_id = c.category_id
                    LEFT JOIN view_discounts vd ON pv.discount_id = vd.discount_id
                    WHERE pv.product_variant_id IN (${idPlaceholders})
                    ORDER BY FIELD(pv.product_variant_id, ${idPlaceholders})
                `;

                console.log('[processAndRecommendProducts] Fetching detailed product info');
                
                db.query(detailQuery, [...recommendedIds, ...recommendedIds], (detailErr, detailResults) => {
                    if (detailErr) {
                        console.error('[processAndRecommendProducts] Error fetching product details:', detailErr);
                        return res.status(500).json({ error: 'Error fetching product details' });
                    }

                    console.log(`[processAndRecommendProducts] Found ${detailResults.length} detailed products`);
                    console.log('[processAndRecommendProducts] Returning recommendations to client');
                    
                    return res.status(200).json({
                        recommended_products: detailResults,
                        ai_recommendation_ids: recommendedIds
                    });
                });
            } else {
                console.log('[processAndRecommendProducts] Invalid recommendation format, using original products');
                
                return res.status(200).json({
                    recommended_products: products,
                    message: 'Using default order due to processing error'
                });
            }
        } catch (aiError) {
            console.error('[processAndRecommendProducts] Error calling OpenAI API:', aiError);
            // Fallback nếu OpenAI gặp lỗi - trả về danh sách ban đầu
            return res.status(200).json({
                recommended_products: products,
                message: 'Using view count order due to AI processing error'
            });
        }
    } catch (error) {
        console.error('[processAndRecommendProducts] Error processing products for recommendation:', error);
        return res.status(500).json({ 
            error: 'Error processing recommendation',
            recommended_products: products 
        });
    }
}

module.exports = router;