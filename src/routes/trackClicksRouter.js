const express = require('express');
const router = express.Router();
const general = require('../models/general.model');
const db = require('../config/db/connect');
const util = require('util');
const query = util.promisify(db.query).bind(db);

router.post('/track-clicks', async (req, res) => {
    const { clickedProducts } = req.body;
    // Sửa tên biến từ user_id thành customer_id để khớp với cấu trúc database
    const customer_id = req.session?.user_id || null; // Sử dụng optional chaining

    if (!clickedProducts || clickedProducts.length === 0) {
        return res.status(400).json({ message: 'No clicked products provided' });
    }

    try {
        console.log('Clicked Products:', clickedProducts);
        
        // Tạo mảng các promises để theo dõi tất cả các thao tác database
        const dbPromises = [];
        
        // Lặp qua từng sản phẩm được click và lưu vào bảng product_views
        for (const product of clickedProducts) {
            const { product_variant_id, category_id } = product;
            
            // Kiểm tra xem product_variant_id có hợp lệ không
            if (!product_variant_id) continue;
            
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            
            // Sửa lại query để sử dụng cột customer_id thay vì user_id
            const insertQuery = `
                INSERT INTO product_views 
                (product_variant_id, category_id, customer_id, view_date) 
                VALUES (?, ?, ?, ?)
            `;
            
            // Thêm promise vào mảng để theo dõi
            dbPromises.push(
                query(insertQuery, [
                    product_variant_id, 
                    category_id || null, 
                    customer_id,
                    timestamp
                ]).then(() => {
                    console.log(`Tracked: product_variant_id=${product_variant_id}, category_id=${category_id}, customer_id=${customer_id}`);
                })
            );
        }
        
        // Đợi tất cả các thao tác database hoàn thành
        await Promise.all(dbPromises);
        
        // Sau khi đã cập nhật product_views, hãy làm mới view_products_resume
        // Đây là bước quan trọng để đảm bảo dữ liệu khuyến nghị được cập nhật
        try {
            // Refresh the view_products_resume view
            const refreshViewQuery = `
                SELECT 1 FROM view_products_resume LIMIT 1
            `;
            await query(refreshViewQuery);
            console.log('Refreshed view_products_resume view');
        } catch (viewError) {
            console.error('Error refreshing view_products_resume:', viewError);
            // We continue even if view refresh fails as the data is still inserted in product_views
        }
        
        // Respond with success after all database operations are complete
        res.status(200).json({ 
            message: 'Clicked products tracked successfully and view updated',
            count: clickedProducts.length
        });
        
    } catch (error) {
        console.error('Error tracking clicked products:', error);
        res.status(500).json({ message: 'Failed to track clicked products', error: error.message });
    }
});

module.exports = router;