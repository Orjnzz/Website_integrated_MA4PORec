// Thêm "active" vào app-bar__element
const appbarEle = document.querySelectorAll('.app-bar__element')
appbarEle[0].classList.add('active')

function calculateDiscountedPrice(originalPrice, discountAmount) {
    return Math.round(originalPrice - originalPrice * (discountAmount / 100))
}

document.addEventListener('DOMContentLoaded', function () {
    const carousel = document.getElementById('cateCarousel')
    const items = document.querySelectorAll('.cate__carousel-col')
    const totalItems = items.length
    const maxItemsDisplay = 7
    let currentIndex = 0

    const prevButton = document.querySelector('#catePrev')
    const nextButton = document.querySelector('#cateNext')
    prevButton.style.display = 'none'

    if (prevButton && nextButton) {
        prevButton.addEventListener('click', showPrev)
        nextButton.addEventListener('click', showNext)
    }

    function showPrev() {
        if (currentIndex !== 0) {
            currentIndex = currentIndex - 1
            updateCarousel()
        }

        if (window.innerWidth > 416) {
            if (currentIndex === 0) {
                prevButton.style.display = 'none'
            }

            if (nextButton.style.display === 'none') {
                nextButton.style.display = 'block'
            }
        }
    }

    function showNext() {
        if ((currentIndex + 1) * maxItemsDisplay < totalItems) {
            currentIndex = currentIndex + 1
            updateCarousel()
        }

        if (window.innerWidth > 416) {
            if (prevButton.style.display === 'none') {
                prevButton.style.display = 'block'
            }

            if ((currentIndex + 1) * maxItemsDisplay >= totalItems) {
                nextButton.style.display = 'none'
            }
        }
    }

    function updateCarousel() {
        const scrollValue = currentIndex * carousel.clientWidth
        carousel.scrollTo({
            left: scrollValue,
            behavior: 'smooth',
        })
    }

    // Thay đổi từ tracking div.product-card sang tracking a.product__card-main
    document.querySelectorAll('.product-card .product__card-main').forEach((productLink) => {
        productLink.addEventListener('click', function () {
            // Lấy product_variant_id từ URL của thẻ a
            const href = this.getAttribute('href');
            const productVariantId = href.split('/')[2].split('?')[0];
            const categoryId = new URLSearchParams(href.split('?')[1]).get('category_id');
            
            // Lấy product_name từ thẻ h4 trong product__card-main
            const productNameElement = this.querySelector('h4');
            // Ưu tiên lấy từ thuộc tính title vì nó chứa tên đầy đủ của sản phẩm
            const productName = productNameElement && productNameElement.getAttribute('title') 
                ? productNameElement.getAttribute('title') 
                : (productNameElement ? productNameElement.textContent.trim() : 'Unknown Product');

            // Retrieve the current session's clicked products from cookies
            let clickedProducts = JSON.parse(localStorage.getItem('clickedProducts')) || [];

            // Thêm thông tin sản phẩm vào danh sách nếu chưa có
            const productInfo = {
                product_variant_id: productVariantId,
                category_id: categoryId,
                product_name: productName, // Thêm product_name vào productInfo
                sended: false // Thêm trường sended mặc định là false
            };

            // Kiểm tra xem sản phẩm đã được click chưa (dựa trên product_variant_id)
            if (!clickedProducts.some(item => item.product_variant_id === productVariantId)) {
                clickedProducts.push(productInfo);
                // Lưu danh sách đã cập nhật vào localStorage
                localStorage.setItem('clickedProducts', JSON.stringify(clickedProducts));
            }
        });
    });

    // Send clicked products to backend for AI recommendations when the homepage loads
    let clickedProducts = JSON.parse(localStorage.getItem('clickedProducts')) || [];

    // DEBUGGING: Log tracked products to console
    console.log('===== TRACKING DEBUGGING =====');
    console.log('Products tracked in this session:', clickedProducts);
    console.log('==============================');

    // Lọc ra những sản phẩm chưa được gửi đến server (sended = false)
    const productsToSend = clickedProducts.filter(product => product.sended === false);

    if (productsToSend.length > 0) {
        console.log('Sending new tracked products to backend:', productsToSend);
        
        fetch('/api/track-clicks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clickedProducts: productsToSend }),
        })
        .then((response) => response.json())
        .then((data) => { 
            // Đánh dấu các sản phẩm đã gửi (sended = true)
            clickedProducts = clickedProducts.map(product => {
                if (productsToSend.some(p => p.product_variant_id === product.product_variant_id)) {
                    return { ...product, sended: true };
                }
                return product;
            });
            


            // Lưu lại danh sách đã cập nhật vào localStorage
            localStorage.setItem('clickedProducts', JSON.stringify(clickedProducts));
            
            console.log('Updated products with sended=true:', clickedProducts);
        })
        .catch((error) => {
            console.error('Error sending click data:', error);
        });
    } else {
        console.log('No new products to send to server');
    }
});