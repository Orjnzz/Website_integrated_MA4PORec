// Thêm "active" vào app-bar__element
const appbarEle = document.querySelectorAll('.app-bar__element')
appbarEle[1].classList.add('active')

// Tracking function to track product clicks
function trackProductClick(productVariantId, categoryId, productName) {
    // Retrieve the current session's clicked products
    let clickedProducts = JSON.parse(localStorage.getItem('clickedProducts')) || [];

    // Thêm thông tin sản phẩm vào danh sách nếu chưa có
    const productInfo = {
        product_variant_id: productVariantId,
        category_id: categoryId,
        product_name: productName, // Thêm tên sản phẩm vào thông tin
        sended: false // Thêm trường sended mặc định là false
    };

    // Kiểm tra xem sản phẩm đã được click chưa (dựa trên product_variant_id)
    if (!clickedProducts.some(item => item.product_variant_id === productVariantId)) {
        clickedProducts.push(productInfo);
        // Save the updated list back to local storage
        localStorage.setItem('clickedProducts', JSON.stringify(clickedProducts));
        console.log('Tracked product:', productVariantId, 'in category:', categoryId);
    }
}

// Thay đổi từ tracking div.product-card sang tracking a.product__card-main
document.querySelectorAll('.product-card .product__card-main, .product-item .product__card-main').forEach((productLink) => {
    productLink.addEventListener('click', function() {
        // Lấy product_variant_id từ URL của thẻ a
        const href = this.getAttribute('href');
        if (href && href.includes('/')) {
            const productVariantId = href.split('/')[2].split('?')[0];
            const categoryId = new URLSearchParams(href.split('?')[1]).get('category_id');
            
            // Lấy product_name từ thẻ h4 trong product__card-main
            const productNameElement = this.querySelector('h4');
            // Ưu tiên lấy từ thuộc tính title vì nó chứa tên đầy đủ của sản phẩm
            const productName = productNameElement && productNameElement.getAttribute('title') 
                ? productNameElement.getAttribute('title') 
                : (productNameElement ? productNameElement.textContent.trim() : 'Unknown Product');


            trackProductClick(productVariantId, categoryId, productName);
        }
    });
});

// DEBUGGING: Log tracked products to console when page loads
document.addEventListener('DOMContentLoaded', function() {
    let clickedProducts = JSON.parse(localStorage.getItem('clickedProducts')) || [];
    
    console.log('===== TRACKING DEBUGGING (category-mobile) =====');
    console.log('Products tracked in this session:', clickedProducts);
    console.log('=======================================');
    
    // Loại bỏ phần gửi dữ liệu lên server - chỉ gửi khi người dùng quay về trang chủ
});